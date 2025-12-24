import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuditLogger, auditLogger } from '../audit-logger';
import prisma from '../db';
import { ProvisioningStepStatus } from '@prisma/client';

describe('AuditLogger', () => {
  let logger: AuditLogger;
  let testJobId: string;
  let testAgencyId: string;

  beforeEach(async () => {
    logger = new AuditLogger();

    // Create test agency
    const agency = await prisma.agency.create({
      data: {
        name: 'Test Agency',
        ghlAgencyId: 'test-ghl-audit',
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
        status: 'IN_PROGRESS',
        clientDataJson: {},
      },
    });
    testJobId = job.id;
  });

  afterEach(async () => {
    await prisma.provisioningLog.deleteMany({});
    await prisma.provisioningJob.deleteMany({});
    await prisma.agency.deleteMany({});
  });

  describe('log', () => {
    it('should create audit log entry', async () => {
      await logger.log({
        jobId: testJobId,
        action: 'PROVISION_JOB_CREATED',
        status: 'success',
        agencyId: testAgencyId,
        details: {
          testField: 'testValue',
        },
      });

      const logs = await prisma.provisioningLog.findMany({
        where: { jobId: testJobId },
      });

      expect(logs.length).toBe(1);
      expect(logs[0].step).toBe('PROVISION_JOB_CREATED');
      expect(logs[0].status).toBe(ProvisioningStepStatus.COMPLETED);

      const details = logs[0].detailsJson as any;
      expect(details.testField).toBe('testValue');
      expect(details.agencyId).toBe(testAgencyId);
      expect(details.timestamp).toBeTruthy();
    });

    it('should handle logging errors gracefully', async () => {
      // Try to log with invalid job ID
      await expect(
        logger.log({
          jobId: 'invalid-job-id',
          action: 'PROVISION_JOB_CREATED',
          status: 'success',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('logBatch', () => {
    it('should create multiple audit log entries', async () => {
      await logger.logBatch([
        {
          jobId: testJobId,
          action: 'PROVISION_JOB_CREATED',
          status: 'success',
        },
        {
          jobId: testJobId,
          action: 'SNAPSHOT_SELECTED',
          status: 'success',
        },
        {
          jobId: testJobId,
          action: 'CUSTOM_VALUES_MAPPED',
          status: 'success',
        },
      ]);

      const logs = await prisma.provisioningLog.findMany({
        where: { jobId: testJobId },
      });

      expect(logs.length).toBe(3);
    });
  });

  describe('Specific log methods', () => {
    it('should log job creation', async () => {
      await logger.logJobCreated(
        testJobId,
        testAgencyId,
        { businessName: 'Test Corp', email: 'test@example.com' },
        'user123',
        '192.168.1.1'
      );

      const logs = await prisma.provisioningLog.findMany({
        where: { jobId: testJobId, step: 'PROVISION_JOB_CREATED' },
      });

      expect(logs.length).toBe(1);
      const details = logs[0].detailsJson as any;
      expect(details.clientData.businessName).toBe('Test Corp');
      expect(details.userId).toBe('user123');
      expect(details.ipAddress).toBe('192.168.1.xxx'); // Masked
    });

    it('should log job completion', async () => {
      await logger.logJobCompleted(
        testJobId,
        testAgencyId,
        'location_123',
        65000, // 65 seconds
        'user123'
      );

      const logs = await prisma.provisioningLog.findMany({
        where: { jobId: testJobId, step: 'PROVISION_JOB_COMPLETED' },
      });

      expect(logs.length).toBe(1);
      const details = logs[0].detailsJson as any;
      expect(details.locationId).toBe('location_123');
      expect(details.durationMs).toBe(65000);
      expect(details.durationHuman).toBe('1m 5s');
    });

    it('should log job failure', async () => {
      await logger.logJobFailed(
        testJobId,
        testAgencyId,
        'Test error message',
        'Error stack trace...',
        'user123'
      );

      const logs = await prisma.provisioningLog.findMany({
        where: { jobId: testJobId, step: 'PROVISION_JOB_FAILED' },
      });

      expect(logs.length).toBe(1);
      expect(logs[0].status).toBe(ProvisioningStepStatus.FAILED);
      const details = logs[0].detailsJson as any;
      expect(details.errorMessage).toBe('Test error message');
      expect(details.errorStack).toBeTruthy();
    });

    it('should log snapshot selection', async () => {
      await logger.logSnapshotSelection(
        testJobId,
        testAgencyId,
        'snapshot_123',
        'Real Estate Pro',
        0.95,
        'Best match for real estate business'
      );

      const logs = await prisma.provisioningLog.findMany({
        where: { jobId: testJobId, step: 'SNAPSHOT_SELECTED' },
      });

      expect(logs.length).toBe(1);
      const details = logs[0].detailsJson as any;
      expect(details.snapshotId).toBe('snapshot_123');
      expect(details.confidenceScore).toBe(0.95);
      expect(details.reasoning).toBeTruthy();
    });

    it('should log custom values mapping', async () => {
      await logger.logCustomValuesMapping(testJobId, testAgencyId, 5, 2, 1);

      const logs = await prisma.provisioningLog.findMany({
        where: { jobId: testJobId, step: 'CUSTOM_VALUES_MAPPED' },
      });

      expect(logs.length).toBe(1);
      const details = logs[0].detailsJson as any;
      expect(details.mappedCount).toBe(5);
      expect(details.unmappedCount).toBe(2);
      expect(details.missingRequiredCount).toBe(1);
    });

    it('should log user provisioning success', async () => {
      await logger.logUserProvisioning(
        testJobId,
        testAgencyId,
        'user@example.com',
        'admin',
        true
      );

      const logs = await prisma.provisioningLog.findMany({
        where: { jobId: testJobId, step: 'USER_PROVISIONED' },
      });

      expect(logs.length).toBe(1);
      expect(logs[0].status).toBe(ProvisioningStepStatus.COMPLETED);
      const details = logs[0].detailsJson as any;
      expect(details.userEmail).toBe('user@example.com');
      expect(details.role).toBe('admin');
    });

    it('should log user provisioning failure', async () => {
      await logger.logUserProvisioning(
        testJobId,
        testAgencyId,
        'user@example.com',
        'admin',
        false,
        'Invalid email format'
      );

      const logs = await prisma.provisioningLog.findMany({
        where: { jobId: testJobId, step: 'USER_PROVISIONED' },
      });

      expect(logs.length).toBe(1);
      expect(logs[0].status).toBe(ProvisioningStepStatus.FAILED);
      const details = logs[0].detailsJson as any;
      expect(details.errorMessage).toBe('Invalid email format');
    });

    it('should log API requests', async () => {
      await logger.logAPIRequest(
        testJobId,
        '/api/provision',
        'POST',
        202,
        150,
        'user123',
        testAgencyId,
        '192.168.1.100',
        'Mozilla/5.0'
      );

      const logs = await prisma.provisioningLog.findMany({
        where: { jobId: testJobId, step: 'API_REQUEST' },
      });

      expect(logs.length).toBe(1);
      const details = logs[0].detailsJson as any;
      expect(details.endpoint).toBe('/api/provision');
      expect(details.method).toBe('POST');
      expect(details.statusCode).toBe(202);
      expect(details.durationMs).toBe(150);
      expect(details.userAgent).toBe('Mozilla/5.0');
    });

    it('should log rate limit exceeded', async () => {
      await logger.logRateLimitExceeded(
        testJobId,
        '/api/provision',
        '192.168.1.1',
        testAgencyId
      );

      const logs = await prisma.provisioningLog.findMany({
        where: { jobId: testJobId, step: 'RATE_LIMIT_EXCEEDED' },
      });

      expect(logs.length).toBe(1);
      const details = logs[0].detailsJson as any;
      expect(details.endpoint).toBe('/api/provision');
      expect(details.ipAddress).toBe('192.168.1.xxx');
    });
  });

  describe('Privacy and security', () => {
    it('should mask IP addresses', async () => {
      await logger.log({
        jobId: testJobId,
        action: 'API_REQUEST',
        status: 'success',
        ipAddress: '192.168.1.100',
      });

      const logs = await prisma.provisioningLog.findMany({
        where: { jobId: testJobId },
      });

      const details = logs[0].detailsJson as any;
      expect(details.ipAddress).toBe('192.168.1.xxx');
    });

    it('should mask IPv6 addresses', async () => {
      await logger.log({
        jobId: testJobId,
        action: 'API_REQUEST',
        status: 'success',
        ipAddress: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
      });

      const logs = await prisma.provisioningLog.findMany({
        where: { jobId: testJobId },
      });

      const details = logs[0].detailsJson as any;
      expect(details.ipAddress).toContain('xxxx');
      expect(details.ipAddress).not.toBe('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
    });

    it('should sanitize sensitive data', async () => {
      await logger.logJobCreated(testJobId, testAgencyId, {
        businessName: 'Test Corp',
        apiKey: 'secret-api-key-123',
        password: 'my-password',
        accessToken: 'token-xyz',
        normalField: 'normal-value',
      });

      const logs = await prisma.provisioningLog.findMany({
        where: { jobId: testJobId },
      });

      const details = logs[0].detailsJson as any;
      expect(details.clientData.businessName).toBe('Test Corp');
      expect(details.clientData.normalField).toBe('normal-value');
      expect(details.clientData.apiKey).toBe('[REDACTED]');
      expect(details.clientData.password).toBe('[REDACTED]');
      expect(details.clientData.accessToken).toBe('[REDACTED]');
    });

    it('should sanitize nested sensitive data', async () => {
      await logger.logJobCreated(testJobId, testAgencyId, {
        user: {
          name: 'John Doe',
          password: 'secret123',
        },
      });

      const logs = await prisma.provisioningLog.findMany({
        where: { jobId: testJobId },
      });

      const details = logs[0].detailsJson as any;
      expect(details.clientData.user.name).toBe('John Doe');
      expect(details.clientData.user.password).toBe('[REDACTED]');
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      // Create multiple log entries
      await logger.logBatch([
        {
          jobId: testJobId,
          action: 'PROVISION_JOB_CREATED',
          status: 'success',
          agencyId: testAgencyId,
        },
        {
          jobId: testJobId,
          action: 'SNAPSHOT_SELECTED',
          status: 'success',
          agencyId: testAgencyId,
        },
        {
          jobId: testJobId,
          action: 'PROVISION_JOB_FAILED',
          status: 'failure',
          agencyId: testAgencyId,
        },
      ]);
    });

    it('should query logs by job ID', async () => {
      const logs = await logger.query({ jobId: testJobId });

      expect(logs.length).toBe(3);
      logs.forEach((log) => {
        expect(log.jobId).toBe(testJobId);
      });
    });

    it('should query logs by action', async () => {
      const logs = await logger.query({ action: 'SNAPSHOT_SELECTED' });

      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('SNAPSHOT_SELECTED');
    });

    it('should query logs by status', async () => {
      const logs = await logger.query({ status: 'failure' });

      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('PROVISION_JOB_FAILED');
    });

    it('should query logs by date range', async () => {
      const startDate = new Date(Date.now() - 1000); // 1 second ago
      const endDate = new Date(Date.now() + 1000); // 1 second from now

      const logs = await logger.query({ startDate, endDate });

      expect(logs.length).toBeGreaterThan(0);
    });

    it('should limit and offset results', async () => {
      const logs1 = await logger.query({ limit: 2, offset: 0 });
      const logs2 = await logger.query({ limit: 2, offset: 2 });

      expect(logs1.length).toBe(2);
      expect(logs2.length).toBe(1);
      expect(logs1[0].id).not.toBe(logs2[0].id);
    });
  });

  describe('getSummary', () => {
    beforeEach(async () => {
      await logger.logBatch([
        {
          jobId: testJobId,
          action: 'PROVISION_JOB_CREATED',
          status: 'success',
          agencyId: testAgencyId,
        },
        {
          jobId: testJobId,
          action: 'SNAPSHOT_SELECTED',
          status: 'success',
          agencyId: testAgencyId,
        },
        {
          jobId: testJobId,
          action: 'PROVISION_JOB_FAILED',
          status: 'failure',
          agencyId: testAgencyId,
        },
        {
          jobId: testJobId,
          action: 'USER_PROVISIONED',
          status: 'success',
          agencyId: testAgencyId,
        },
      ]);
    });

    it('should return summary statistics', async () => {
      const summary = await logger.getSummary({ agencyId: testAgencyId });

      expect(summary.totalLogs).toBe(4);
      expect(summary.successCount).toBe(3);
      expect(summary.failureCount).toBe(1);
      expect(summary.actionBreakdown).toEqual({
        PROVISION_JOB_CREATED: 1,
        SNAPSHOT_SELECTED: 1,
        PROVISION_JOB_FAILED: 1,
        USER_PROVISIONED: 1,
      });
    });

    it('should filter summary by date range', async () => {
      const startDate = new Date(Date.now() - 1000);
      const endDate = new Date(Date.now() + 1000);

      const summary = await logger.getSummary({ startDate, endDate });

      expect(summary.totalLogs).toBeGreaterThan(0);
    });
  });

  describe('Duration formatting', () => {
    it('should format milliseconds', async () => {
      await logger.logJobCompleted(testJobId, testAgencyId, 'loc_1', 500);

      const logs = await prisma.provisioningLog.findMany({
        where: { jobId: testJobId },
      });

      const details = logs[0].detailsJson as any;
      expect(details.durationHuman).toBe('500ms');
    });

    it('should format seconds', async () => {
      await logger.logJobCompleted(testJobId, testAgencyId, 'loc_1', 5000);

      const logs = await prisma.provisioningLog.findMany({
        where: { jobId: testJobId },
      });

      const details = logs[0].detailsJson as any;
      expect(details.durationHuman).toBe('5s');
    });

    it('should format minutes and seconds', async () => {
      await logger.logJobCompleted(testJobId, testAgencyId, 'loc_1', 125000);

      const logs = await prisma.provisioningLog.findMany({
        where: { jobId: testJobId },
      });

      const details = logs[0].detailsJson as any;
      expect(details.durationHuman).toBe('2m 5s');
    });

    it('should format hours and minutes', async () => {
      await logger.logJobCompleted(testJobId, testAgencyId, 'loc_1', 3900000);

      const logs = await prisma.provisioningLog.findMany({
        where: { jobId: testJobId },
      });

      const details = logs[0].detailsJson as any;
      expect(details.durationHuman).toBe('1h 5m');
    });
  });

  describe('Singleton instance', () => {
    it('should export singleton instance', () => {
      expect(auditLogger).toBeInstanceOf(AuditLogger);
    });
  });
});
