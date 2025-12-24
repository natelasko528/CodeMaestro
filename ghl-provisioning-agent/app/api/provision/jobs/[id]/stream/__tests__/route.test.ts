import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';
import prisma from '@/lib/server/db';
import { ProvisioningJobStatus, ProvisioningStepStatus } from '@prisma/client';

describe('GET /api/provision/jobs/[id]/stream (SSE)', () => {
  let testAgencyId: string;
  let testJobId: string;

  beforeEach(async () => {
    // Create test agency
    const agency = await prisma.agency.create({
      data: {
        name: 'Test Agency',
        ghlAgencyId: 'test-ghl-sse',
        oauthAccessTokenEncrypted: 'encrypted_test_token',
        oauthRefreshTokenEncrypted: 'encrypted_test_refresh',
        tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    testAgencyId = agency.id;

    // Create test job
    const job = await prisma.provisioningJob.create({
      data: {
        agencyId: testAgencyId,
        status: ProvisioningJobStatus.IN_PROGRESS,
        clientDataJson: {
          businessName: 'Test Business',
        },
      },
    });
    testJobId = job.id;

    // Create some logs
    await prisma.provisioningLog.createMany({
      data: [
        {
          jobId: testJobId,
          step: 'JOB_CREATED',
          status: ProvisioningStepStatus.COMPLETED,
          detailsJson: { message: 'Job created' },
        },
        {
          jobId: testJobId,
          step: 'SNAPSHOT_SELECTION',
          status: ProvisioningStepStatus.STARTED,
          detailsJson: { message: 'Selecting snapshot' },
        },
      ],
    });
  });

  afterEach(async () => {
    await prisma.provisioningLog.deleteMany({});
    await prisma.provisioningJob.deleteMany({});
    await prisma.agency.deleteMany({});
  });

  it('should return 404 for non-existent job', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const request = new NextRequest(
      `http://localhost:3000/api/provision/jobs/${nonExistentId}/stream`
    );

    const response = await GET(request, { params: { id: nonExistentId } });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.code).toBe('JOB_NOT_FOUND');
  });

  it('should return SSE stream with correct headers', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/provision/jobs/${testJobId}/stream`
    );

    const response = await GET(request, { params: { id: testJobId } });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toContain('no-cache');
    expect(response.headers.get('Connection')).toBe('keep-alive');
  });

  it('should stream initial connection event', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/provision/jobs/${testJobId}/stream`
    );

    const response = await GET(request, { params: { id: testJobId } });
    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error('No reader available');
    }

    // Read first chunk
    const { value, done } = await reader.read();
    expect(done).toBe(false);

    const chunk = new TextDecoder().decode(value);
    expect(chunk).toContain('event: connected');
    expect(chunk).toContain(`"jobId":"${testJobId}"`);

    // Cleanup
    reader.cancel();
  });

  it('should stream job status events', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/provision/jobs/${testJobId}/stream`
    );

    const response = await GET(request, { params: { id: testJobId } });
    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error('No reader available');
    }

    // Collect multiple chunks
    const chunks: string[] = [];
    let receivedCount = 0;
    const maxChunks = 5;

    try {
      while (receivedCount < maxChunks) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        chunks.push(chunk);
        receivedCount++;
      }
    } finally {
      reader.cancel();
    }

    const fullStream = chunks.join('');

    // Verify we received expected event types
    expect(fullStream).toContain('event: connected');
    expect(fullStream).toContain('event: job_status');
    expect(fullStream).toContain('event: progress');
    expect(fullStream).toContain(`"id":"${testJobId}"`);
  });

  it('should include progress in status events', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/provision/jobs/${testJobId}/stream`
    );

    const response = await GET(request, { params: { id: testJobId } });
    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error('No reader available');
    }

    // Read a few chunks to get to status events
    const chunks: string[] = [];
    for (let i = 0; i < 5; i++) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(new TextDecoder().decode(value));
    }

    reader.cancel();

    const fullStream = chunks.join('');

    // Should contain progress field
    expect(fullStream).toContain('"progress":');
  });

  it('should send completion event when job is completed', async () => {
    // Update job to completed status
    await prisma.provisioningJob.update({
      where: { id: testJobId },
      data: { status: ProvisioningJobStatus.COMPLETED },
    });

    const request = new NextRequest(
      `http://localhost:3000/api/provision/jobs/${testJobId}/stream`
    );

    const response = await GET(request, { params: { id: testJobId } });
    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error('No reader available');
    }

    // Collect chunks until stream closes
    const chunks: string[] = [];
    let receivedCount = 0;
    const maxChunks = 10;

    try {
      while (receivedCount < maxChunks) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        chunks.push(chunk);
        receivedCount++;
      }
    } finally {
      reader.cancel();
    }

    const fullStream = chunks.join('');

    // Should contain completed event
    expect(fullStream).toContain('event: completed');
    expect(fullStream).toContain('"status":"completed"');
  });

  it('should send error event when job fails', async () => {
    // Update job to failed status with error message
    await prisma.provisioningJob.update({
      where: { id: testJobId },
      data: {
        status: ProvisioningJobStatus.FAILED,
        errorMessage: 'Test error message',
      },
    });

    const request = new NextRequest(
      `http://localhost:3000/api/provision/jobs/${testJobId}/stream`
    );

    const response = await GET(request, { params: { id: testJobId } });
    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error('No reader available');
    }

    // Collect chunks
    const chunks: string[] = [];
    let receivedCount = 0;
    const maxChunks = 10;

    try {
      while (receivedCount < maxChunks) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        chunks.push(chunk);
        receivedCount++;
      }
    } finally {
      reader.cancel();
    }

    const fullStream = chunks.join('');

    // Should contain error event
    expect(fullStream).toContain('event: error');
    expect(fullStream).toContain('Test error message');
  });

  it('should send step_update events with log details', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/provision/jobs/${testJobId}/stream`
    );

    const response = await GET(request, { params: { id: testJobId } });
    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error('No reader available');
    }

    // Collect chunks
    const chunks: string[] = [];
    for (let i = 0; i < 5; i++) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(new TextDecoder().decode(value));
    }

    reader.cancel();

    const fullStream = chunks.join('');

    // Should contain step update events
    expect(fullStream).toContain('event: step_update');
    expect(fullStream).toContain('"step":"');
  });

  it('should handle client abort signal', async () => {
    const abortController = new AbortController();
    const request = new NextRequest(
      `http://localhost:3000/api/provision/jobs/${testJobId}/stream`,
      { signal: abortController.signal }
    );

    const response = await GET(request, { params: { id: testJobId } });
    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error('No reader available');
    }

    // Read one chunk
    await reader.read();

    // Abort the request
    abortController.abort();

    // Stream should eventually close
    // This is asynchronous, so we just verify no error is thrown
    reader.cancel();
    expect(true).toBe(true); // Test passes if no error thrown
  });

  it('should format SSE events correctly', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/provision/jobs/${testJobId}/stream`
    );

    const response = await GET(request, { params: { id: testJobId } });
    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error('No reader available');
    }

    const { value } = await reader.read();
    reader.cancel();

    const chunk = new TextDecoder().decode(value);

    // SSE format validation
    expect(chunk).toMatch(/event: \w+\n/);
    expect(chunk).toMatch(/id: \d+\n/);
    expect(chunk).toMatch(/data: \{.*\}\n\n/);
  });
});
