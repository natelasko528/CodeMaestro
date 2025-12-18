import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProvisioningJobStatus } from '@prisma/client';
import { JobQueue, JobPayload, JobResult } from '../job-queue';
import prisma from '../db';

describe('JobQueue', () => {
  let queue: JobQueue;
  let processedJobs: Array<{ id: string; payload: JobPayload }> = [];

  // Mock job processor
  const mockProcessor = async (
    jobId: string,
    payload: JobPayload
  ): Promise<JobResult> => {
    processedJobs.push({ id: jobId, payload });

    // Simulate successful processing
    return {
      success: true,
      locationId: `loc_${jobId.slice(0, 8)}`,
    };
  };

  beforeEach(() => {
    processedJobs = [];
    queue = new JobQueue(mockProcessor, {
      pollInterval: 100, // Short interval for testing
      maxRetries: 3,
      retryDelay: 100,
    });
  });

  afterEach(async () => {
    queue.stop();
    // Clean up test data
    await prisma.provisioningLog.deleteMany({});
    await prisma.provisioningJob.deleteMany({});
    await prisma.agency.deleteMany({});
  });

  describe('enqueue', () => {
    it('should create a new job in pending status', async () => {
      // Create test agency
      const agency = await prisma.agency.create({
        data: {
          name: 'Test Agency',
          ghlAgencyId: 'test-agency-123',
          oauthAccessTokenEncrypted: 'encrypted-token',
          oauthRefreshTokenEncrypted: 'encrypted-refresh',
          tokenExpiresAt: new Date(Date.now() + 3600000),
        },
      });

      const payload: JobPayload = {
        agencyId: agency.id,
        clientData: {
          businessName: 'Test Business',
          email: 'test@example.com',
        },
      };

      const jobId = await queue.enqueue(payload);

      expect(jobId).toBeTruthy();

      // Verify job was created
      const job = await prisma.provisioningJob.findUnique({
        where: { id: jobId },
      });

      expect(job).toBeDefined();
      expect(job?.status).toBe(ProvisioningJobStatus.PENDING);
      expect(job?.agencyId).toBe(agency.id);
      expect(job?.clientDataJson).toEqual(payload.clientData);

      // Verify log was created
      const logs = await prisma.provisioningLog.findMany({
        where: { jobId },
      });

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].step).toBe('JOB_CREATED');
    });

    it('should include snapshot ID if provided', async () => {
      const agency = await prisma.agency.create({
        data: {
          name: 'Test Agency',
          ghlAgencyId: 'test-agency-456',
          oauthAccessTokenEncrypted: 'encrypted-token',
          oauthRefreshTokenEncrypted: 'encrypted-refresh',
          tokenExpiresAt: new Date(Date.now() + 3600000),
        },
      });

      const snapshot = await prisma.snapshot.create({
        data: {
          agencyId: agency.id,
          ghlSnapshotId: 'snap-123',
          name: 'Test Snapshot',
        },
      });

      const payload: JobPayload = {
        agencyId: agency.id,
        clientData: { businessName: 'Test' },
        snapshotId: snapshot.id,
      };

      const jobId = await queue.enqueue(payload);

      const job = await prisma.provisioningJob.findUnique({
        where: { id: jobId },
      });

      expect(job?.snapshotId).toBe(snapshot.id);
    });
  });

  describe('getJobStatus', () => {
    it('should return job status and progress', async () => {
      const agency = await prisma.agency.create({
        data: {
          name: 'Test Agency',
          ghlAgencyId: 'test-agency-789',
          oauthAccessTokenEncrypted: 'encrypted-token',
          oauthRefreshTokenEncrypted: 'encrypted-refresh',
          tokenExpiresAt: new Date(Date.now() + 3600000),
        },
      });

      const jobId = await queue.enqueue({
        agencyId: agency.id,
        clientData: { businessName: 'Test' },
      });

      const status = await queue.getJobStatus(jobId);

      expect(status).toBeDefined();
      expect(status?.id).toBe(jobId);
      expect(status?.status).toBe(ProvisioningJobStatus.PENDING);
      expect(status?.progress).toBeGreaterThanOrEqual(0);
    });

    it('should return null for non-existent job', async () => {
      const status = await queue.getJobStatus('nonexistent-job-id');
      expect(status).toBeNull();
    });
  });

  describe('getAgencyJobs', () => {
    it('should return all jobs for an agency', async () => {
      const agency = await prisma.agency.create({
        data: {
          name: 'Test Agency',
          ghlAgencyId: 'test-agency-abc',
          oauthAccessTokenEncrypted: 'encrypted-token',
          oauthRefreshTokenEncrypted: 'encrypted-refresh',
          tokenExpiresAt: new Date(Date.now() + 3600000),
        },
      });

      // Create multiple jobs
      await queue.enqueue({
        agencyId: agency.id,
        clientData: { businessName: 'Test 1' },
      });
      await queue.enqueue({
        agencyId: agency.id,
        clientData: { businessName: 'Test 2' },
      });

      const jobs = await queue.getAgencyJobs(agency.id);

      expect(jobs).toBeDefined();
      expect(jobs.length).toBe(2);
      expect(jobs[0].status).toBe(ProvisioningJobStatus.PENDING);
    });

    it('should filter jobs by status', async () => {
      const agency = await prisma.agency.create({
        data: {
          name: 'Test Agency',
          ghlAgencyId: 'test-agency-def',
          oauthAccessTokenEncrypted: 'encrypted-token',
          oauthRefreshTokenEncrypted: 'encrypted-refresh',
          tokenExpiresAt: new Date(Date.now() + 3600000),
        },
      });

      const jobId = await queue.enqueue({
        agencyId: agency.id,
        clientData: { businessName: 'Test' },
      });

      // Mark job as completed
      await prisma.provisioningJob.update({
        where: { id: jobId },
        data: { status: ProvisioningJobStatus.COMPLETED },
      });

      const completedJobs = await queue.getAgencyJobs(agency.id, {
        status: ProvisioningJobStatus.COMPLETED,
      });

      expect(completedJobs.length).toBe(1);
      expect(completedJobs[0].status).toBe(ProvisioningJobStatus.COMPLETED);

      const pendingJobs = await queue.getAgencyJobs(agency.id, {
        status: ProvisioningJobStatus.PENDING,
      });

      expect(pendingJobs.length).toBe(0);
    });

    it('should support pagination', async () => {
      const agency = await prisma.agency.create({
        data: {
          name: 'Test Agency',
          ghlAgencyId: 'test-agency-ghi',
          oauthAccessTokenEncrypted: 'encrypted-token',
          oauthRefreshTokenEncrypted: 'encrypted-refresh',
          tokenExpiresAt: new Date(Date.now() + 3600000),
        },
      });

      // Create 5 jobs
      for (let i = 0; i < 5; i++) {
        await queue.enqueue({
          agencyId: agency.id,
          clientData: { businessName: `Test ${i}` },
        });
      }

      const firstPage = await queue.getAgencyJobs(agency.id, {
        limit: 2,
        offset: 0,
      });

      expect(firstPage.length).toBe(2);

      const secondPage = await queue.getAgencyJobs(agency.id, {
        limit: 2,
        offset: 2,
      });

      expect(secondPage.length).toBe(2);
      expect(secondPage[0].id).not.toBe(firstPage[0].id);
    });
  });

  describe('cancelJob', () => {
    it('should cancel a pending job', async () => {
      const agency = await prisma.agency.create({
        data: {
          name: 'Test Agency',
          ghlAgencyId: 'test-agency-jkl',
          oauthAccessTokenEncrypted: 'encrypted-token',
          oauthRefreshTokenEncrypted: 'encrypted-refresh',
          tokenExpiresAt: new Date(Date.now() + 3600000),
        },
      });

      const jobId = await queue.enqueue({
        agencyId: agency.id,
        clientData: { businessName: 'Test' },
      });

      await queue.cancelJob(jobId);

      const job = await prisma.provisioningJob.findUnique({
        where: { id: jobId },
      });

      expect(job?.status).toBe(ProvisioningJobStatus.FAILED);
      expect(job?.errorMessage).toContain('cancelled');
    });

    it('should throw error for non-existent job', async () => {
      await expect(queue.cancelJob('nonexistent')).rejects.toThrow('Job not found');
    });

    it('should throw error for completed job', async () => {
      const agency = await prisma.agency.create({
        data: {
          name: 'Test Agency',
          ghlAgencyId: 'test-agency-mno',
          oauthAccessTokenEncrypted: 'encrypted-token',
          oauthRefreshTokenEncrypted: 'encrypted-refresh',
          tokenExpiresAt: new Date(Date.now() + 3600000),
        },
      });

      const jobId = await queue.enqueue({
        agencyId: agency.id,
        clientData: { businessName: 'Test' },
      });

      // Mark as completed
      await prisma.provisioningJob.update({
        where: { id: jobId },
        data: { status: ProvisioningJobStatus.COMPLETED },
      });

      await expect(queue.cancelJob(jobId)).rejects.toThrow('Cannot cancel');
    });
  });

  describe('FIFO ordering', () => {
    it('should process jobs in FIFO order', async () => {
      const agency = await prisma.agency.create({
        data: {
          name: 'Test Agency',
          ghlAgencyId: 'test-agency-pqr',
          oauthAccessTokenEncrypted: 'encrypted-token',
          oauthRefreshTokenEncrypted: 'encrypted-refresh',
          tokenExpiresAt: new Date(Date.now() + 3600000),
        },
      });

      // Enqueue jobs with delay to ensure ordering
      const job1Id = await queue.enqueue({
        agencyId: agency.id,
        clientData: { businessName: 'First' },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const job2Id = await queue.enqueue({
        agencyId: agency.id,
        clientData: { businessName: 'Second' },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const job3Id = await queue.enqueue({
        agencyId: agency.id,
        clientData: { businessName: 'Third' },
      });

      // Verify creation order
      const jobs = await prisma.provisioningJob.findMany({
        where: { agencyId: agency.id },
        orderBy: { createdAt: 'asc' },
      });

      expect(jobs[0].id).toBe(job1Id);
      expect(jobs[1].id).toBe(job2Id);
      expect(jobs[2].id).toBe(job3Id);
    });
  });
});
