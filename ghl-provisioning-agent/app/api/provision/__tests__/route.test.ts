import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';
import prisma from '@/lib/server/db';
import { ProvisioningJobStatus } from '@prisma/client';

// Mock the job queue
vi.mock('@/lib/server/job-queue', () => {
  return {
    JobQueue: vi.fn().mockImplementation(() => ({
      enqueue: vi.fn().mockResolvedValue('job_test_123'),
    })),
  };
});

describe('POST /api/provision', () => {
  let testAgencyId: string;
  let testSnapshotId: string;

  beforeEach(async () => {
    // Create test agency
    const agency = await prisma.agency.create({
      data: {
        name: 'Test Agency',
        ghlAgencyId: 'test-ghl-agency-001',
        oauthAccessTokenEncrypted: 'encrypted_test_token',
        oauthRefreshTokenEncrypted: 'encrypted_test_refresh',
        tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      },
    });
    testAgencyId = agency.id;

    // Create test snapshot
    const snapshot = await prisma.snapshot.create({
      data: {
        agencyId: testAgencyId,
        ghlSnapshotId: 'test-snapshot-001',
        name: 'Test Snapshot',
        niche: 'Real Estate',
        isActive: true,
      },
    });
    testSnapshotId = snapshot.id;
  });

  afterEach(async () => {
    // Cleanup
    await prisma.provisioningLog.deleteMany({});
    await prisma.provisioningJob.deleteMany({});
    await prisma.snapshot.deleteMany({});
    await prisma.agency.deleteMany({});
  });

  it('should create a provisioning job with valid data', async () => {
    const requestBody = {
      agencyId: testAgencyId,
      intakeData: {
        businessName: 'Test Business',
        contactName: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        industry: 'Real Estate',
      },
      snapshotId: testSnapshotId,
    };

    const request = new NextRequest('http://localhost:3000/api/provision', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data.success).toBe(true);
    expect(data.jobId).toBeTruthy();
    expect(data.status).toBe('pending');
    expect(data.message).toBe('Provisioning job created successfully');
    expect(data.estimatedCompletionTime).toBeTruthy();

    // Verify job was created in database
    const job = await prisma.provisioningJob.findUnique({
      where: { id: data.jobId },
    });

    expect(job).toBeTruthy();
    expect(job?.agencyId).toBe(testAgencyId);
    expect(job?.status).toBe(ProvisioningJobStatus.PENDING);
    expect(job?.snapshotId).toBe(testSnapshotId);
  });

  it('should create a job without snapshotId (AI selection)', async () => {
    const requestBody = {
      agencyId: testAgencyId,
      intakeData: {
        businessName: 'Test Business',
        industry: 'Real Estate',
      },
      options: {
        useAISnapshotSelection: true,
      },
    };

    const request = new NextRequest('http://localhost:3000/api/provision', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data.success).toBe(true);
    expect(data.jobId).toBeTruthy();
  });

  it('should reject request with invalid agency ID', async () => {
    const requestBody = {
      agencyId: 'invalid-uuid',
      intakeData: {
        businessName: 'Test Business',
      },
    };

    const request = new NextRequest('http://localhost:3000/api/provision', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.details).toBeTruthy();
  });

  it('should return 404 for non-existent agency', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const requestBody = {
      agencyId: nonExistentId,
      intakeData: {
        businessName: 'Test Business',
      },
    };

    const request = new NextRequest('http://localhost:3000/api/provision', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.code).toBe('AGENCY_NOT_FOUND');
  });

  it('should return 401 for expired OAuth token', async () => {
    // Create agency with expired token
    const expiredAgency = await prisma.agency.create({
      data: {
        name: 'Expired Agency',
        ghlAgencyId: 'expired-ghl-agency',
        oauthAccessTokenEncrypted: 'encrypted_test_token',
        oauthRefreshTokenEncrypted: 'encrypted_test_refresh',
        tokenExpiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      },
    });

    const requestBody = {
      agencyId: expiredAgency.id,
      intakeData: {
        businessName: 'Test Business',
      },
    };

    const request = new NextRequest('http://localhost:3000/api/provision', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe('TOKEN_EXPIRED');

    // Cleanup
    await prisma.agency.delete({ where: { id: expiredAgency.id } });
  });

  it('should return 404 for non-existent snapshot', async () => {
    const nonExistentSnapshotId = '00000000-0000-0000-0000-000000000000';
    const requestBody = {
      agencyId: testAgencyId,
      intakeData: {
        businessName: 'Test Business',
      },
      snapshotId: nonExistentSnapshotId,
    };

    const request = new NextRequest('http://localhost:3000/api/provision', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.code).toBe('SNAPSHOT_NOT_FOUND');
  });

  it('should reject request with empty intake data', async () => {
    const requestBody = {
      agencyId: testAgencyId,
      intakeData: {},
    };

    const request = new NextRequest('http://localhost:3000/api/provision', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('should reject invalid JSON', async () => {
    const request = new NextRequest('http://localhost:3000/api/provision', {
      method: 'POST',
      body: 'invalid json{',
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('INVALID_JSON');
  });

  it('should accept custom values and options', async () => {
    const requestBody = {
      agencyId: testAgencyId,
      intakeData: {
        businessName: 'Test Business',
      },
      snapshotId: testSnapshotId,
      customValues: {
        field1: 'value1',
        field2: 'value2',
      },
      options: {
        useAISnapshotSelection: false,
        useAICustomValueMapping: false,
        sendWelcomeEmail: true,
        webhookUrl: 'https://example.com/webhook',
      },
    };

    const request = new NextRequest('http://localhost:3000/api/provision', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data.success).toBe(true);

    // Verify options were stored
    const job = await prisma.provisioningJob.findUnique({
      where: { id: data.jobId },
    });

    const clientData = job?.clientDataJson as any;
    expect(clientData.customValues).toEqual({
      field1: 'value1',
      field2: 'value2',
    });
    expect(clientData.options.webhookUrl).toBe('https://example.com/webhook');
  });
});
