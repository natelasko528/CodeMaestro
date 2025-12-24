import prisma from './db';
import { ProvisioningStepStatus } from '@prisma/client';

export type AuditAction =
  | 'PROVISION_JOB_CREATED'
  | 'PROVISION_JOB_STARTED'
  | 'PROVISION_JOB_COMPLETED'
  | 'PROVISION_JOB_FAILED'
  | 'PROVISION_JOB_CANCELLED'
  | 'SNAPSHOT_SELECTED'
  | 'CUSTOM_VALUES_MAPPED'
  | 'CUSTOM_VALUES_APPLIED'
  | 'USER_PROVISIONED'
  | 'LOCATION_CREATED'
  | 'SNAPSHOT_APPLIED'
  | 'API_REQUEST'
  | 'AUTH_SUCCESS'
  | 'AUTH_FAILURE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'ERROR_OCCURRED';

export interface AuditLogEntry {
  jobId: string;
  action: AuditAction;
  status: 'success' | 'failure' | 'info';
  userId?: string;
  agencyId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
  errorMessage?: string;
}

/**
 * Audit logging system
 * Logs all provisioning operations with full context for compliance and debugging
 */
export class AuditLogger {
  /**
   * Log an audit event
   * @param entry - Audit log entry
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      // Map our status to Prisma enum
      const prismaStatus = this.mapStatusToPrisma(entry.status);

      // Create log entry in database
      await prisma.provisioningLog.create({
        data: {
          jobId: entry.jobId,
          step: entry.action,
          status: prismaStatus,
          detailsJson: {
            ...entry.details,
            userId: entry.userId,
            agencyId: entry.agencyId,
            ipAddress: this.maskIPAddress(entry.ipAddress),
            userAgent: entry.userAgent,
            errorMessage: entry.errorMessage,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      // Don't throw - logging failure shouldn't break the application
      console.error('Failed to write audit log:', error);
    }
  }

  /**
   * Log multiple audit events in batch
   * @param entries - Array of audit log entries
   */
  async logBatch(entries: AuditLogEntry[]): Promise<void> {
    try {
      await prisma.provisioningLog.createMany({
        data: entries.map((entry) => ({
          jobId: entry.jobId,
          step: entry.action,
          status: this.mapStatusToPrisma(entry.status),
          detailsJson: {
            ...entry.details,
            userId: entry.userId,
            agencyId: entry.agencyId,
            ipAddress: this.maskIPAddress(entry.ipAddress),
            userAgent: entry.userAgent,
            errorMessage: entry.errorMessage,
            timestamp: new Date().toISOString(),
          },
        })),
      });
    } catch (error) {
      console.error('Failed to write batch audit logs:', error);
    }
  }

  /**
   * Log provisioning job creation
   */
  async logJobCreated(
    jobId: string,
    agencyId: string,
    clientData: Record<string, any>,
    userId?: string,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      jobId,
      action: 'PROVISION_JOB_CREATED',
      status: 'success',
      userId,
      agencyId,
      ipAddress,
      details: {
        clientData: this.sanitizeData(clientData),
      },
    });
  }

  /**
   * Log provisioning job completion
   */
  async logJobCompleted(
    jobId: string,
    agencyId: string,
    locationId: string,
    durationMs: number,
    userId?: string
  ): Promise<void> {
    await this.log({
      jobId,
      action: 'PROVISION_JOB_COMPLETED',
      status: 'success',
      userId,
      agencyId,
      details: {
        locationId,
        durationMs,
        durationHuman: this.formatDuration(durationMs),
      },
    });
  }

  /**
   * Log provisioning job failure
   */
  async logJobFailed(
    jobId: string,
    agencyId: string,
    errorMessage: string,
    errorStack?: string,
    userId?: string
  ): Promise<void> {
    await this.log({
      jobId,
      action: 'PROVISION_JOB_FAILED',
      status: 'failure',
      userId,
      agencyId,
      errorMessage,
      details: {
        errorStack: errorStack?.substring(0, 1000), // Truncate stack trace
      },
    });
  }

  /**
   * Log snapshot selection
   */
  async logSnapshotSelection(
    jobId: string,
    agencyId: string,
    snapshotId: string,
    snapshotName: string,
    confidenceScore: number,
    reasoning: string
  ): Promise<void> {
    await this.log({
      jobId,
      action: 'SNAPSHOT_SELECTED',
      status: 'success',
      agencyId,
      details: {
        snapshotId,
        snapshotName,
        confidenceScore,
        reasoning,
      },
    });
  }

  /**
   * Log custom values mapping
   */
  async logCustomValuesMapping(
    jobId: string,
    agencyId: string,
    mappedCount: number,
    unmappedCount: number,
    missingRequiredCount: number
  ): Promise<void> {
    await this.log({
      jobId,
      action: 'CUSTOM_VALUES_MAPPED',
      status: 'success',
      agencyId,
      details: {
        mappedCount,
        unmappedCount,
        missingRequiredCount,
      },
    });
  }

  /**
   * Log user provisioning
   */
  async logUserProvisioning(
    jobId: string,
    agencyId: string,
    userEmail: string,
    role: string,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    await this.log({
      jobId,
      action: 'USER_PROVISIONED',
      status: success ? 'success' : 'failure',
      agencyId,
      errorMessage,
      details: {
        userEmail,
        role,
      },
    });
  }

  /**
   * Log API request
   */
  async logAPIRequest(
    jobId: string,
    endpoint: string,
    method: string,
    statusCode: number,
    durationMs: number,
    userId?: string,
    agencyId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      jobId,
      action: 'API_REQUEST',
      status: statusCode < 400 ? 'success' : 'failure',
      userId,
      agencyId,
      ipAddress,
      userAgent,
      details: {
        endpoint,
        method,
        statusCode,
        durationMs,
      },
    });
  }

  /**
   * Log rate limit exceeded
   */
  async logRateLimitExceeded(
    jobId: string,
    endpoint: string,
    ipAddress?: string,
    agencyId?: string
  ): Promise<void> {
    await this.log({
      jobId,
      action: 'RATE_LIMIT_EXCEEDED',
      status: 'info',
      agencyId,
      ipAddress,
      details: {
        endpoint,
      },
    });
  }

  /**
   * Query audit logs with filters
   */
  async query(filters: {
    jobId?: string;
    agencyId?: string;
    action?: AuditAction;
    status?: 'success' | 'failure' | 'info';
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<Array<{
    id: string;
    jobId: string;
    action: string;
    status: string;
    timestamp: Date;
    details: any;
  }>> {
    const logs = await prisma.provisioningLog.findMany({
      where: {
        ...(filters.jobId && { jobId: filters.jobId }),
        ...(filters.action && { step: filters.action }),
        ...(filters.status && { status: this.mapStatusToPrisma(filters.status) }),
        ...(filters.startDate && { timestamp: { gte: filters.startDate } }),
        ...(filters.endDate && { timestamp: { lte: filters.endDate } }),
        ...(filters.agencyId && {
          job: {
            agencyId: filters.agencyId,
          },
        }),
      },
      select: {
        id: true,
        jobId: true,
        step: true,
        status: true,
        timestamp: true,
        detailsJson: true,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: filters.limit || 100,
      skip: filters.offset || 0,
    });

    return logs.map((log) => ({
      id: log.id,
      jobId: log.jobId,
      action: log.step,
      status: log.status.toLowerCase(),
      timestamp: log.timestamp,
      details: log.detailsJson,
    }));
  }

  /**
   * Get audit summary statistics
   */
  async getSummary(filters: {
    agencyId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    totalLogs: number;
    successCount: number;
    failureCount: number;
    actionBreakdown: Record<string, number>;
  }> {
    const logs = await prisma.provisioningLog.findMany({
      where: {
        ...(filters.startDate && { timestamp: { gte: filters.startDate } }),
        ...(filters.endDate && { timestamp: { lte: filters.endDate } }),
        ...(filters.agencyId && {
          job: {
            agencyId: filters.agencyId,
          },
        }),
      },
      select: {
        step: true,
        status: true,
      },
    });

    const successCount = logs.filter(
      (log) => log.status === ProvisioningStepStatus.COMPLETED
    ).length;

    const failureCount = logs.filter(
      (log) => log.status === ProvisioningStepStatus.FAILED
    ).length;

    const actionBreakdown: Record<string, number> = {};
    logs.forEach((log) => {
      actionBreakdown[log.step] = (actionBreakdown[log.step] || 0) + 1;
    });

    return {
      totalLogs: logs.length,
      successCount,
      failureCount,
      actionBreakdown,
    };
  }

  /**
   * Map our status enum to Prisma enum
   */
  private mapStatusToPrisma(status: 'success' | 'failure' | 'info'): ProvisioningStepStatus {
    switch (status) {
      case 'success':
        return ProvisioningStepStatus.COMPLETED;
      case 'failure':
        return ProvisioningStepStatus.FAILED;
      case 'info':
        return ProvisioningStepStatus.STARTED;
      default:
        return ProvisioningStepStatus.STARTED;
    }
  }

  /**
   * Mask IP address for privacy (keep first 3 octets)
   */
  private maskIPAddress(ip?: string): string | undefined {
    if (!ip) return undefined;

    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
    }

    // IPv6 or other format - just mask last part
    const segments = ip.split(':');
    if (segments.length > 1) {
      return segments.slice(0, -1).join(':') + ':xxxx';
    }

    return ip;
  }

  /**
   * Sanitize sensitive data from logs
   */
  private sanitizeData(data: Record<string, any>): Record<string, any> {
    const sanitized = { ...data };

    // List of sensitive field names to mask
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'apiKey',
      'accessToken',
      'refreshToken',
      'creditCard',
      'ssn',
      'taxId',
    ];

    for (const key in sanitized) {
      const lowerKey = key.toLowerCase();
      if (sensitiveFields.some((field) => lowerKey.includes(field.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      }

      // Recursively sanitize nested objects
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeData(sanitized[key]);
      }
    }

    return sanitized;
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }

    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) {
      return `${minutes}m ${remainingSeconds}s`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();

export default AuditLogger;
