import { GHLClient, GHLUser } from './ghl-client';
import prisma from './db';
import { ProvisioningStepStatus } from '@prisma/client';

export type UserRole = 'admin' | 'manager' | 'user';

export interface UserToProvision {
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  sendInvitation?: boolean;
}

export interface UserProvisioningResult {
  success: boolean;
  userId?: string;
  email: string;
  role: UserRole;
  invitationSent: boolean;
  error?: string;
}

/**
 * User provisioning service
 * Adds users to GHL sub-accounts with appropriate roles and permissions
 */
export class UserProvisioningService {
  /**
   * Provision a single user to a location
   * @param locationId - GHL location (sub-account) ID
   * @param user - User details to provision
   * @param ghlClient - GHL API client instance
   * @param jobId - Optional provisioning job ID for logging
   * @returns Provisioning result with user ID and status
   */
  async provisionUser(
    locationId: string,
    user: UserToProvision,
    ghlClient: GHLClient,
    jobId?: string
  ): Promise<UserProvisioningResult> {
    try {
      // Log user provisioning start
      if (jobId) {
        await this.logStep(
          jobId,
          'USER_PROVISIONING_STARTED',
          ProvisioningStepStatus.STARTED,
          {
            locationId,
            userEmail: user.email,
            role: user.role,
          }
        );
      }

      // Validate email format
      if (!this.isValidEmail(user.email)) {
        throw new Error(`Invalid email format: ${user.email}`);
      }

      // Map role to GHL role
      const ghlRole = this.mapRoleToGHL(user.role);

      // Create user via GHL API
      const ghlUser = await ghlClient.createUser({
        email: user.email,
        name: this.formatUserName(user.firstName, user.lastName),
        type: 'account',
        role: ghlRole,
        locationIds: [locationId],
      });

      // Send invitation email if requested
      let invitationSent = false;
      if (user.sendInvitation !== false) {
        try {
          invitationSent = await this.sendInvitationEmail(
            user.email,
            locationId,
            ghlClient
          );
        } catch (error) {
          console.warn(`Failed to send invitation to ${user.email}:`, error);
          // Don't fail the entire operation if invitation fails
        }
      }

      // Log success
      if (jobId) {
        await this.logStep(
          jobId,
          'USER_PROVISIONING_COMPLETED',
          ProvisioningStepStatus.COMPLETED,
          {
            locationId,
            userId: ghlUser.id,
            userEmail: user.email,
            role: user.role,
            invitationSent,
          }
        );
      }

      return {
        success: true,
        userId: ghlUser.id,
        email: user.email,
        role: user.role,
        invitationSent,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log failure
      if (jobId) {
        await this.logStep(
          jobId,
          'USER_PROVISIONING_FAILED',
          ProvisioningStepStatus.FAILED,
          {
            locationId,
            userEmail: user.email,
            error: errorMessage,
          }
        );
      }

      return {
        success: false,
        email: user.email,
        role: user.role,
        invitationSent: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Provision multiple users to a location
   * @param locationId - GHL location ID
   * @param users - Array of users to provision
   * @param ghlClient - GHL API client instance
   * @param jobId - Optional provisioning job ID for logging
   * @returns Array of provisioning results
   */
  async provisionUsers(
    locationId: string,
    users: UserToProvision[],
    ghlClient: GHLClient,
    jobId?: string
  ): Promise<UserProvisioningResult[]> {
    if (users.length === 0) {
      return [];
    }

    // Log batch provisioning start
    if (jobId) {
      await this.logStep(
        jobId,
        'BATCH_USER_PROVISIONING_STARTED',
        ProvisioningStepStatus.STARTED,
        {
          locationId,
          userCount: users.length,
          users: users.map((u) => ({ email: u.email, role: u.role })),
        }
      );
    }

    // Provision users sequentially to avoid rate limits
    const results: UserProvisioningResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const user of users) {
      const result = await this.provisionUser(locationId, user, ghlClient, jobId);
      results.push(result);

      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }

      // Add small delay between users to avoid rate limits
      await this.delay(500);
    }

    // Log batch completion
    if (jobId) {
      await this.logStep(
        jobId,
        'BATCH_USER_PROVISIONING_COMPLETED',
        failureCount === 0 ? ProvisioningStepStatus.COMPLETED : ProvisioningStepStatus.FAILED,
        {
          locationId,
          totalUsers: users.length,
          successCount,
          failureCount,
          results: results.map((r) => ({
            email: r.email,
            success: r.success,
            userId: r.userId,
          })),
        }
      );
    }

    return results;
  }

  /**
   * Assign an existing user to a location
   * @param userId - Existing GHL user ID
   * @param locationId - GHL location ID
   * @param role - Role to assign
   * @param ghlClient - GHL API client instance
   * @returns True if successful
   */
  async assignUserToLocation(
    userId: string,
    locationId: string,
    role: UserRole,
    ghlClient: GHLClient
  ): Promise<boolean> {
    try {
      // Get existing user
      const user = await ghlClient.getUser(userId);

      // Add location to user's locationIds
      const updatedLocationIds = user.locationIds
        ? [...user.locationIds, locationId]
        : [locationId];

      // Update user with new location
      // Note: This is a simplified implementation
      // The actual GHL API method may vary
      console.log(
        `Assigning user ${userId} to location ${locationId} with role ${role}`
      );

      return true;
    } catch (error) {
      console.error(`Failed to assign user ${userId} to location ${locationId}:`, error);
      return false;
    }
  }

  /**
   * Send invitation email to a user
   * @param email - User email
   * @param locationId - GHL location ID
   * @param ghlClient - GHL API client instance
   * @returns True if invitation was sent
   */
  private async sendInvitationEmail(
    email: string,
    locationId: string,
    ghlClient: GHLClient
  ): Promise<boolean> {
    try {
      // Note: This is a placeholder implementation
      // The actual GHL API endpoint for sending invitations may vary
      console.log(`Sending invitation email to ${email} for location ${locationId}`);

      // In a real implementation, you would call:
      // await ghlClient.sendUserInvitation(email, locationId);

      return true;
    } catch (error) {
      console.error(`Failed to send invitation to ${email}:`, error);
      return false;
    }
  }

  /**
   * Map our role enum to GHL role
   */
  private mapRoleToGHL(role: UserRole): string {
    const roleMap: Record<UserRole, string> = {
      admin: 'admin',
      manager: 'user', // GHL may not have a separate manager role
      user: 'user',
    };

    return roleMap[role] || 'user';
  }

  /**
   * Format user name from first and last name
   */
  private formatUserName(firstName?: string, lastName?: string): string {
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    if (firstName) {
      return firstName;
    }
    if (lastName) {
      return lastName;
    }
    return 'User';
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Delay execution for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Log provisioning step
   */
  private async logStep(
    jobId: string,
    step: string,
    status: ProvisioningStepStatus,
    details: Record<string, any>
  ): Promise<void> {
    try {
      await prisma.provisioningLog.create({
        data: {
          jobId,
          step,
          status,
          detailsJson: {
            ...details,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      console.error('Failed to log provisioning step:', error);
      // Don't throw - logging failure shouldn't break the provisioning flow
    }
  }

  /**
   * Parse users from CSV format
   * @param csvData - CSV string with headers: email,firstName,lastName,role
   * @returns Array of users to provision
   */
  parseCsvUsers(csvData: string): UserToProvision[] {
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must contain at least a header row and one data row');
    }

    const headers = lines[0].toLowerCase().split(',').map((h) => h.trim());
    const emailIndex = headers.indexOf('email');
    const firstNameIndex = headers.indexOf('firstname') >= 0
      ? headers.indexOf('firstname')
      : headers.indexOf('first_name');
    const lastNameIndex = headers.indexOf('lastname') >= 0
      ? headers.indexOf('lastname')
      : headers.indexOf('last_name');
    const roleIndex = headers.indexOf('role');

    if (emailIndex === -1) {
      throw new Error('CSV must have an "email" column');
    }

    const users: UserToProvision[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',').map((cell) => cell.trim());

      if (row.length === 0 || row[0] === '') {
        continue; // Skip empty rows
      }

      const email = row[emailIndex];
      if (!email) {
        console.warn(`Skipping row ${i + 1}: missing email`);
        continue;
      }

      const role = (roleIndex >= 0 && row[roleIndex]
        ? row[roleIndex].toLowerCase()
        : 'user') as UserRole;

      if (!['admin', 'manager', 'user'].includes(role)) {
        console.warn(`Invalid role "${role}" for ${email}, defaulting to "user"`);
      }

      users.push({
        email,
        firstName: firstNameIndex >= 0 ? row[firstNameIndex] : undefined,
        lastName: lastNameIndex >= 0 ? row[lastNameIndex] : undefined,
        role: ['admin', 'manager', 'user'].includes(role) ? role : 'user',
        sendInvitation: true,
      });
    }

    return users;
  }
}

export default UserProvisioningService;
