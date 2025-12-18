import { ProvisioningJobStatus, ProvisioningStepStatus } from '@prisma/client';
import prisma from './db';

export interface JobPayload {
  agencyId: string;
  clientData: Record<string, any>;
  snapshotId?: string;
  options?: Record<string, any>;
}

export interface JobResult {
  success: boolean;
  locationId?: string;
  error?: string;
}

export type JobProcessor = (
  jobId: string,
  payload: JobPayload
) => Promise<JobResult>;

/**
 * Database-based job queue using PostgreSQL
 * Provides FIFO ordering, retry logic, and status tracking
 */
export class JobQueue {
  private processor: JobProcessor;
  private isProcessing: boolean = false;
  private pollInterval: number = 5000; // 5 seconds
  private maxRetries: number = 3;
  private retryDelay: number = 60000; // 1 minute

  constructor(processor: JobProcessor, options?: {
    pollInterval?: number;
    maxRetries?: number;
    retryDelay?: number;
  }) {
    this.processor = processor;
    if (options?.pollInterval) this.pollInterval = options.pollInterval;
    if (options?.maxRetries) this.maxRetries = options.maxRetries;
    if (options?.retryDelay) this.retryDelay = options.retryDelay;
  }

  /**
   * Enqueue a new provisioning job
   * @param payload - Job data including agency ID and client data
   * @returns Job ID
   */
  async enqueue(payload: JobPayload): Promise<string> {
    const job = await prisma.provisioningJob.create({
      data: {
        agencyId: payload.agencyId,
        status: ProvisioningJobStatus.PENDING,
        clientDataJson: payload.clientData,
        snapshotId: payload.snapshotId,
        retryCount: 0,
      },
    });

    // Log job creation
    await prisma.provisioningLog.create({
      data: {
        jobId: job.id,
        step: 'JOB_CREATED',
        status: ProvisioningStepStatus.COMPLETED,
        detailsJson: {
          message: 'Job created and queued for processing',
          agencyId: payload.agencyId,
        },
      },
    });

    return job.id;
  }

  /**
   * Get the next pending job (FIFO order)
   * Uses atomic UPDATE to prevent race conditions
   */
  private async getNextJob(): Promise<{ id: string; payload: JobPayload } | null> {
    // Use raw SQL for atomic SELECT FOR UPDATE SKIP LOCKED
    // This ensures only one worker can claim a job at a time
    const result = await prisma.$queryRaw<Array<{
      id: string;
      agencyId: string;
      clientDataJson: any;
      snapshotId: string | null;
    }>>`
      UPDATE provisioning_jobs
      SET status = ${ProvisioningJobStatus.IN_PROGRESS}::provisioning_job_status,
          updated_at = NOW()
      WHERE id = (
        SELECT id
        FROM provisioning_jobs
        WHERE status = ${ProvisioningJobStatus.PENDING}::provisioning_job_status
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, agency_id as "agencyId", client_data_json as "clientDataJson", snapshot_id as "snapshotId"
    `;

    if (result.length === 0) {
      return null;
    }

    const job = result[0];

    // Log job processing started
    await prisma.provisioningLog.create({
      data: {
        jobId: job.id,
        step: 'JOB_PROCESSING',
        status: ProvisioningStepStatus.STARTED,
        detailsJson: {
          message: 'Job processing started',
        },
      },
    });

    return {
      id: job.id,
      payload: {
        agencyId: job.agencyId,
        clientData: job.clientDataJson as Record<string, any>,
        snapshotId: job.snapshotId || undefined,
      },
    };
  }

  /**
   * Mark job as completed
   */
  private async completeJob(jobId: string, result: JobResult): Promise<void> {
    await prisma.provisioningJob.update({
      where: { id: jobId },
      data: {
        status: ProvisioningJobStatus.COMPLETED,
        locationId: result.locationId,
        updatedAt: new Date(),
      },
    });

    await prisma.provisioningLog.create({
      data: {
        jobId,
        step: 'JOB_COMPLETED',
        status: ProvisioningStepStatus.COMPLETED,
        detailsJson: {
          message: 'Job completed successfully',
          locationId: result.locationId,
        },
      },
    });
  }

  /**
   * Mark job as failed
   * If retries are available, set to RETRYING status
   */
  private async failJob(jobId: string, error: string): Promise<void> {
    const job = await prisma.provisioningJob.findUnique({
      where: { id: jobId },
      select: { retryCount: true },
    });

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const shouldRetry = job.retryCount < this.maxRetries;

    await prisma.provisioningJob.update({
      where: { id: jobId },
      data: {
        status: shouldRetry
          ? ProvisioningJobStatus.RETRYING
          : ProvisioningJobStatus.FAILED,
        errorMessage: error,
        retryCount: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    await prisma.provisioningLog.create({
      data: {
        jobId,
        step: shouldRetry ? 'JOB_RETRYING' : 'JOB_FAILED',
        status: ProvisioningStepStatus.FAILED,
        detailsJson: {
          message: shouldRetry
            ? `Job failed, will retry (attempt ${job.retryCount + 1}/${this.maxRetries})`
            : 'Job failed after max retries',
          error,
          retryCount: job.retryCount + 1,
          maxRetries: this.maxRetries,
        },
      },
    });

    // If should retry, re-queue the job after delay
    if (shouldRetry) {
      setTimeout(async () => {
        await prisma.provisioningJob.update({
          where: { id: jobId },
          data: {
            status: ProvisioningJobStatus.PENDING,
            updatedAt: new Date(),
          },
        });
      }, this.retryDelay);
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: { id: string; payload: JobPayload }): Promise<void> {
    try {
      console.log(`Processing job ${job.id}...`);
      const result = await this.processor(job.id, job.payload);

      if (result.success) {
        await this.completeJob(job.id, result);
        console.log(`Job ${job.id} completed successfully`);
      } else {
        await this.failJob(job.id, result.error || 'Job processing failed');
        console.log(`Job ${job.id} failed: ${result.error}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.failJob(job.id, errorMessage);
      console.error(`Job ${job.id} processing error:`, error);
    }
  }

  /**
   * Start processing jobs from the queue
   * Polls for pending jobs at regular intervals
   */
  async start(): Promise<void> {
    if (this.isProcessing) {
      console.log('Queue processor already running');
      return;
    }

    this.isProcessing = true;
    console.log('Starting job queue processor...');

    while (this.isProcessing) {
      try {
        const job = await this.getNextJob();

        if (job) {
          await this.processJob(job);
        } else {
          // No jobs available, wait before checking again
          await new Promise((resolve) => setTimeout(resolve, this.pollInterval));
        }
      } catch (error) {
        console.error('Error in job queue processor:', error);
        // Wait before retrying after error
        await new Promise((resolve) => setTimeout(resolve, this.pollInterval));
      }
    }

    console.log('Job queue processor stopped');
  }

  /**
   * Stop processing jobs
   */
  stop(): void {
    console.log('Stopping job queue processor...');
    this.isProcessing = false;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<{
    id: string;
    status: ProvisioningJobStatus;
    progress?: number;
    error?: string;
    locationId?: string;
  } | null> {
    const job = await prisma.provisioningJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        status: true,
        errorMessage: true,
        locationId: true,
        logs: {
          select: {
            step: true,
            status: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!job) {
      return null;
    }

    // Calculate progress based on completed steps
    const totalSteps = job.logs.length;
    const completedSteps = job.logs.filter(
      (log) => log.status === ProvisioningStepStatus.COMPLETED
    ).length;
    const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    return {
      id: job.id,
      status: job.status,
      progress,
      error: job.errorMessage || undefined,
      locationId: job.locationId || undefined,
    };
  }

  /**
   * Get all jobs for an agency
   */
  async getAgencyJobs(
    agencyId: string,
    options?: {
      status?: ProvisioningJobStatus;
      limit?: number;
      offset?: number;
    }
  ): Promise<Array<{
    id: string;
    status: ProvisioningJobStatus;
    createdAt: Date;
    updatedAt: Date;
    locationId?: string;
    error?: string;
  }>> {
    const jobs = await prisma.provisioningJob.findMany({
      where: {
        agencyId,
        ...(options?.status && { status: options.status }),
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        locationId: true,
        errorMessage: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    });

    return jobs.map((job) => ({
      id: job.id,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      locationId: job.locationId || undefined,
      error: job.errorMessage || undefined,
    }));
  }

  /**
   * Cancel a pending or in-progress job
   */
  async cancelJob(jobId: string): Promise<void> {
    const job = await prisma.provisioningJob.findUnique({
      where: { id: jobId },
      select: { status: true },
    });

    if (!job) {
      throw new Error('Job not found');
    }

    if (
      job.status !== ProvisioningJobStatus.PENDING &&
      job.status !== ProvisioningJobStatus.IN_PROGRESS &&
      job.status !== ProvisioningJobStatus.RETRYING
    ) {
      throw new Error('Cannot cancel job with status: ' + job.status);
    }

    await prisma.provisioningJob.update({
      where: { id: jobId },
      data: {
        status: ProvisioningJobStatus.FAILED,
        errorMessage: 'Job cancelled by user',
        updatedAt: new Date(),
      },
    });

    await prisma.provisioningLog.create({
      data: {
        jobId,
        step: 'JOB_CANCELLED',
        status: ProvisioningStepStatus.FAILED,
        detailsJson: {
          message: 'Job cancelled by user',
        },
      },
    });
  }
}

export default JobQueue;
