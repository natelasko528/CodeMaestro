import { NextRequest, NextResponse } from 'next/server';
import { provisionRequestSchema, formatZodError } from '@/lib/validators';
import { JobQueue } from '@/lib/server/job-queue';
import prisma from '@/lib/server/db';
import { z } from 'zod';

/**
 * POST /api/provision
 * Main provisioning endpoint - creates a new sub-account provisioning job
 *
 * Accepts client data, creates provisioning job, triggers queue processing
 * Returns job ID and status for tracking
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validatedData = provisionRequestSchema.parse(body);

    // Verify agency exists
    const agency = await prisma.agency.findUnique({
      where: { id: validatedData.agencyId },
      select: { id: true, name: true, tokenExpiresAt: true },
    });

    if (!agency) {
      return NextResponse.json(
        {
          code: 'AGENCY_NOT_FOUND',
          message: `Agency with ID '${validatedData.agencyId}' not found`,
          timestamp: new Date().toISOString(),
          path: '/api/provision',
        },
        { status: 404 }
      );
    }

    // Check if OAuth token is still valid
    if (new Date() >= agency.tokenExpiresAt) {
      return NextResponse.json(
        {
          code: 'TOKEN_EXPIRED',
          message: 'OAuth token has expired. Please re-authenticate with GoHighLevel.',
          timestamp: new Date().toISOString(),
          path: '/api/provision',
        },
        { status: 401 }
      );
    }

    // If snapshotId is provided, verify it exists and belongs to the agency
    if (validatedData.snapshotId) {
      const snapshot = await prisma.snapshot.findFirst({
        where: {
          id: validatedData.snapshotId,
          agencyId: validatedData.agencyId,
          isActive: true,
        },
      });

      if (!snapshot) {
        return NextResponse.json(
          {
            code: 'SNAPSHOT_NOT_FOUND',
            message: `Snapshot with ID '${validatedData.snapshotId}' not found or not available for this agency`,
            timestamp: new Date().toISOString(),
            path: '/api/provision',
          },
          { status: 404 }
        );
      }
    }

    // Create a job queue instance (with a placeholder processor for now)
    // The actual processor will be implemented in the provisioning engine
    const jobQueue = new JobQueue(async () => {
      return { success: true };
    });

    // Enqueue the provisioning job
    const jobId = await jobQueue.enqueue({
      agencyId: validatedData.agencyId,
      clientData: {
        ...validatedData.intakeData,
        customValues: validatedData.customValues,
        options: validatedData.options,
      },
      snapshotId: validatedData.snapshotId,
    });

    // Calculate estimated completion time (5 minutes from now)
    const estimatedCompletionTime = new Date();
    estimatedCompletionTime.setMinutes(estimatedCompletionTime.getMinutes() + 5);

    // Return 202 Accepted with job details
    return NextResponse.json(
      {
        success: true,
        jobId,
        status: 'pending',
        message: 'Provisioning job created successfully',
        estimatedCompletionTime: estimatedCompletionTime.toISOString(),
      },
      { status: 202 }
    );

  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        formatZodError(error),
        { status: 400 }
      );
    }

    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          code: 'INVALID_JSON',
          message: 'Request body must be valid JSON',
          timestamp: new Date().toISOString(),
          path: '/api/provision',
        },
        { status: 400 }
      );
    }

    // Handle unexpected errors
    console.error('Unexpected error in POST /api/provision:', error);
    return NextResponse.json(
      {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
        path: '/api/provision',
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/provision
 * CORS preflight handler
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
