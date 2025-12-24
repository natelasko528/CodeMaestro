import { NextRequest } from 'next/server';
import prisma from '@/lib/server/db';
import { ProvisioningJobStatus, ProvisioningStepStatus } from '@prisma/client';

/**
 * GET /api/provision/jobs/[id]/stream
 * Server-Sent Events (SSE) endpoint for real-time job updates
 *
 * Streams job status updates, progress, and step completions to the client
 * Connection remains open until job completion or client disconnect
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const jobId = params.id;

  // Verify job exists
  const job = await prisma.provisioningJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      status: true,
      agencyId: true,
    },
  });

  if (!job) {
    return new Response(
      JSON.stringify({
        code: 'JOB_NOT_FOUND',
        message: `Job with ID '${jobId}' not found`,
      }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Create SSE response stream
  const encoder = new TextEncoder();
  let isClientConnected = true;
  let eventId = 0;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection event
      const connectionEvent = formatSSEEvent('connected', {
        jobId,
        timestamp: new Date().toISOString(),
      }, eventId++);
      controller.enqueue(encoder.encode(connectionEvent));

      // Send initial job status
      await sendJobStatus(controller, encoder, jobId, eventId++);

      // Poll for updates
      const pollInterval = setInterval(async () => {
        if (!isClientConnected) {
          clearInterval(pollInterval);
          controller.close();
          return;
        }

        try {
          await sendJobStatus(controller, encoder, jobId, eventId++);

          // Check if job is complete
          const currentJob = await prisma.provisioningJob.findUnique({
            where: { id: jobId },
            select: { status: true },
          });

          if (
            currentJob &&
            (currentJob.status === ProvisioningJobStatus.COMPLETED ||
              currentJob.status === ProvisioningJobStatus.FAILED)
          ) {
            // Send completion event
            const completionEvent = formatSSEEvent(
              'completed',
              {
                id: jobId,
                status: currentJob.status.toLowerCase(),
                timestamp: new Date().toISOString(),
              },
              eventId++
            );
            controller.enqueue(encoder.encode(completionEvent));

            // Close the stream
            clearInterval(pollInterval);
            controller.close();
          }
        } catch (error) {
          console.error('Error in SSE polling:', error);
          // Send error event
          const errorEvent = formatSSEEvent(
            'error',
            {
              code: 'POLLING_ERROR',
              message: 'Failed to fetch job updates',
              timestamp: new Date().toISOString(),
            },
            eventId++
          );
          controller.enqueue(encoder.encode(errorEvent));
        }
      }, 2000); // Poll every 2 seconds

      // Send keep-alive comments every 30 seconds
      const keepAliveInterval = setInterval(() => {
        if (!isClientConnected) {
          clearInterval(keepAliveInterval);
          return;
        }
        controller.enqueue(encoder.encode(': keep-alive\n\n'));
      }, 30000);

      // Cleanup on client disconnect
      request.signal.addEventListener('abort', () => {
        isClientConnected = false;
        clearInterval(pollInterval);
        clearInterval(keepAliveInterval);
        controller.close();
      });
    },
  });

  // Return SSE response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering in nginx
    },
  });
}

/**
 * Send current job status as SSE event
 */
async function sendJobStatus(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  jobId: string,
  eventId: number
): Promise<void> {
  const job = await prisma.provisioningJob.findUnique({
    where: { id: jobId },
    include: {
      logs: {
        orderBy: { createdAt: 'desc' },
        take: 10, // Last 10 log entries
      },
    },
  });

  if (!job) {
    return;
  }

  // Calculate progress
  const totalSteps = job.logs.length;
  const completedSteps = job.logs.filter(
    (log) => log.status === ProvisioningStepStatus.COMPLETED
  ).length;
  const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  // Send job_status event
  const statusEvent = formatSSEEvent(
    'job_status',
    {
      id: job.id,
      status: job.status.toLowerCase(),
      progress,
      timestamp: new Date().toISOString(),
    },
    eventId
  );
  controller.enqueue(encoder.encode(statusEvent));

  // Send progress event
  const progressEvent = formatSSEEvent(
    'progress',
    {
      progress,
      timestamp: new Date().toISOString(),
    },
    eventId + 1
  );
  controller.enqueue(encoder.encode(progressEvent));

  // Send latest step update if available
  if (job.logs.length > 0) {
    const latestLog = job.logs[0];
    const stepEvent = formatSSEEvent(
      'step_update',
      {
        step: latestLog.step,
        status: latestLog.status.toLowerCase(),
        message: (latestLog.detailsJson as any)?.message || latestLog.step,
        details: latestLog.detailsJson,
        timestamp: latestLog.timestamp.toISOString(),
      },
      eventId + 2
    );
    controller.enqueue(encoder.encode(stepEvent));
  }

  // Send error event if job failed
  if (job.status === ProvisioningJobStatus.FAILED && job.errorMessage) {
    const errorEvent = formatSSEEvent(
      'error',
      {
        code: 'JOB_FAILED',
        message: job.errorMessage,
        timestamp: new Date().toISOString(),
      },
      eventId + 3
    );
    controller.enqueue(encoder.encode(errorEvent));
  }
}

/**
 * Format data as SSE event
 * @param event - Event type
 * @param data - Event data
 * @param id - Event ID
 * @returns Formatted SSE string
 */
function formatSSEEvent(event: string, data: any, id: number): string {
  return `event: ${event}\nid: ${id}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * OPTIONS /api/provision/jobs/[id]/stream
 * CORS preflight handler
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
