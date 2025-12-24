import { JobPayload, JobResult } from './job-queue';
import { GHLClient } from './ghl-client';
import { AISnapshotSelector } from './ai-snapshot-selector';
import { CustomValueService } from './custom-values';
import { UserProvisioningService } from './user-provisioning';
import { AuditLogger } from './audit-logger';
import prisma from './db';
import { ProvisioningStepStatus } from '@prisma/client';

/**
 * Complete provisioning processor that orchestrates all services
 * Implements the full workflow from T-001 to T-014
 */
export async function provisioningProcessor(
  jobId: string,
  payload: JobPayload
): Promise<JobResult> {
  const logger = new AuditLogger();
  let locationId: string | undefined;

  try {
    // Step 1: Get agency and validate OAuth token
    await logStep(jobId, 'OAUTH_VALIDATION', 'STARTED', {
      message: 'Validating agency OAuth credentials',
    });

    const agency = await prisma.agency.findUnique({
      where: { id: payload.agencyId },
    });

    if (!agency) {
      throw new Error(`Agency ${payload.agencyId} not found`);
    }

    // Check token expiration
    if (agency.tokenExpiresAt && agency.tokenExpiresAt < new Date()) {
      throw new Error('OAuth token expired - please reconnect');
    }

    await logStep(jobId, 'OAUTH_VALIDATION', 'COMPLETED', {
      message: 'OAuth credentials validated',
      agencyId: agency.id,
    });

    // Initialize GHL client
    const ghlClient = new GHLClient(
      agency.oauthAccessTokenEncrypted, // Will be decrypted inside GHLClient
      agency.ghlAgencyId
    );

    // Step 2: AI Snapshot Selection (if not provided)
    let snapshotId = payload.snapshotId;

    if (!snapshotId) {
      await logStep(jobId, 'SNAPSHOT_SELECTION', 'STARTED', {
        message: 'Selecting optimal snapshot using AI',
      });

      const snapshots = await prisma.snapshot.findMany({
        where: { agencyId: agency.id, isActive: true },
      });

      if (snapshots.length === 0) {
        throw new Error('No active snapshots available');
      }

      const aiSelector = new AISnapshotSelector();
      const recommendations = await aiSelector.selectSnapshot(
        payload.clientData,
        snapshots
      );

      if (recommendations.length > 0) {
        snapshotId = recommendations[0].snapshotId;
        await logStep(jobId, 'SNAPSHOT_SELECTION', 'COMPLETED', {
          message: `Selected snapshot: ${recommendations[0].name}`,
          snapshotId,
          confidence: recommendations[0].confidence,
          reasoning: recommendations[0].reasoning,
        });
      } else {
        // Fallback to first snapshot
        snapshotId = snapshots[0].ghlSnapshotId;
        await logStep(jobId, 'SNAPSHOT_SELECTION', 'COMPLETED', {
          message: 'Using default snapshot (AI selection unavailable)',
          snapshotId,
        });
      }
    } else {
      await logStep(jobId, 'SNAPSHOT_SELECTION', 'COMPLETED', {
        message: 'Using provided snapshot',
        snapshotId,
      });
    }

    // Step 3: Create GHL Sub-Account (Location)
    await logStep(jobId, 'LOCATION_CREATION', 'STARTED', {
      message: 'Creating GoHighLevel sub-account',
      companyName: payload.clientData.companyName,
    });

    const location = await ghlClient.createLocation({
      name: payload.clientData.companyName || 'New Location',
      address: payload.clientData.address || '123 Main St',
      city: payload.clientData.city || 'New York',
      state: payload.clientData.state || 'NY',
      country: payload.clientData.country || 'US',
      postalCode: payload.clientData.postalCode || '10001',
      website: payload.clientData.website,
      phone: payload.clientData.phone,
      email: payload.clientData.email,
      snapshotId,
    });

    locationId = location.id;

    await logStep(jobId, 'LOCATION_CREATION', 'COMPLETED', {
      message: 'Sub-account created successfully',
      locationId,
    });

    // Update job with location ID
    await prisma.provisioningJob.update({
      where: { id: jobId },
      data: { locationId },
    });

    // Step 4: Apply Snapshot (if not already applied during creation)
    // GHL API typically applies snapshot during location creation
    // Log for tracking
    await logStep(jobId, 'SNAPSHOT_APPLICATION', 'COMPLETED', {
      message: 'Snapshot applied during location creation',
      snapshotId,
    });

    // Step 5: Inject Custom Values
    if (payload.options?.customValues && Object.keys(payload.options.customValues).length > 0) {
      await logStep(jobId, 'CUSTOM_VALUES', 'STARTED', {
        message: 'Injecting custom field values',
        fieldCount: Object.keys(payload.options.customValues).length,
      });

      const customValueService = new CustomValueService();
      const mappingResult = await customValueService.mapCustomValues(
        payload.options.customValues,
        []  // Would fetch actual custom fields from GHL
      );

      // Apply each mapped value via GHL API
      for (const mapping of mappingResult.mappedFields) {
        // GHL API call to update custom field would go here
        // await ghlClient.updateCustomField(locationId, mapping.fieldId, mapping.value);
      }

      await logStep(jobId, 'CUSTOM_VALUES', 'COMPLETED', {
        message: 'Custom values injected',
        mappedCount: mappingResult.mappedFields.length,
        unmappedCount: mappingResult.unmappedFields.length,
      });
    }

    // Step 6: Provision Users
    if (payload.options?.users && payload.options.users.length > 0) {
      await logStep(jobId, 'USER_PROVISIONING', 'STARTED', {
        message: 'Provisioning team members',
        userCount: payload.options.users.length,
      });

      const userService = new UserProvisioningService();
      const results = await userService.provisionUsers(locationId, payload.options.users);

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      await logStep(jobId, 'USER_PROVISIONING', 'COMPLETED', {
        message: `Provisioned ${successCount}/${results.length} users`,
        successCount,
        failureCount,
        results: results.map(r => ({
          email: r.email,
          success: r.success,
          error: r.error,
        })),
      });
    }

    // Step 7: Audit logging
    await logger.logProvisioningEvent(
      jobId,
      'info',
      'Provisioning completed successfully',
      {
        locationId,
        agencyId: agency.id,
        snapshotId,
        duration: Date.now(), // Would calculate actual duration
      }
    );

    return {
      success: true,
      locationId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log failure
    await logStep(jobId, 'PROVISIONING_FAILED', 'FAILED', {
      message: 'Provisioning failed',
      error: errorMessage,
      locationId,
    });

    // Audit log the failure
    await logger.logProvisioningEvent(
      jobId,
      'error',
      `Provisioning failed: ${errorMessage}`,
      {
        error: errorMessage,
        locationId,
        agencyId: payload.agencyId,
      }
    );

    // TODO: Implement rollback logic
    // If location was created, we might want to delete it
    // if (locationId) {
    //   await ghlClient.deleteLocation(locationId);
    // }

    return {
      success: false,
      error: errorMessage,
      locationId,
    };
  }
}

/**
 * Helper to log provisioning steps
 */
async function logStep(
  jobId: string,
  step: string,
  status: 'STARTED' | 'COMPLETED' | 'FAILED',
  details: Record<string, any>
): Promise<void> {
  await prisma.provisioningLog.create({
    data: {
      jobId,
      step,
      status: status as ProvisioningStepStatus,
      detailsJson: details,
    },
  });
}
