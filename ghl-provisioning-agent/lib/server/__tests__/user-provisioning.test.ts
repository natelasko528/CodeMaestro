import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UserProvisioningService, UserToProvision } from '../user-provisioning';
import { GHLClient } from '../ghl-client';
import prisma from '../db';

// Mock GHL Client
const mockGHLClient = {
  createUser: vi.fn(),
  getUser: vi.fn(),
} as unknown as GHLClient;

describe('UserProvisioningService', () => {
  let service: UserProvisioningService;
  let testJobId: string;

  beforeEach(async () => {
    service = new UserProvisioningService();
    vi.clearAllMocks();

    // Create test provisioning job
    const job = await prisma.provisioningJob.create({
      data: {
        agencyId: 'test-agency-id',
        status: 'IN_PROGRESS',
        clientDataJson: {},
      },
    });
    testJobId = job.id;
  });

  afterEach(async () => {
    await prisma.provisioningLog.deleteMany({});
    await prisma.provisioningJob.deleteMany({});
  });

  describe('provisionUser', () => {
    it('should provision a user with admin role', async () => {
      const user: UserToProvision = {
        email: 'admin@example.com',
        firstName: 'John',
        lastName: 'Admin',
        role: 'admin',
        sendInvitation: true,
      };

      (mockGHLClient.createUser as any).mockResolvedValue({
        id: 'user_123',
        email: user.email,
        name: 'John Admin',
        role: 'admin',
      });

      const result = await service.provisionUser(
        'location_123',
        user,
        mockGHLClient,
        testJobId
      );

      expect(result.success).toBe(true);
      expect(result.userId).toBe('user_123');
      expect(result.email).toBe('admin@example.com');
      expect(result.role).toBe('admin');
      expect(result.invitationSent).toBe(true);

      // Verify GHL API was called
      expect(mockGHLClient.createUser).toHaveBeenCalledWith({
        email: 'admin@example.com',
        name: 'John Admin',
        type: 'account',
        role: 'admin',
        locationIds: ['location_123'],
      });

      // Verify logs were created
      const logs = await prisma.provisioningLog.findMany({
        where: { jobId: testJobId },
      });
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should provision a user with manager role', async () => {
      const user: UserToProvision = {
        email: 'manager@example.com',
        role: 'manager',
      };

      (mockGHLClient.createUser as any).mockResolvedValue({
        id: 'user_456',
        email: user.email,
        role: 'user',
      });

      const result = await service.provisionUser(
        'location_123',
        user,
        mockGHLClient
      );

      expect(result.success).toBe(true);
      expect(result.userId).toBe('user_456');
      expect(result.role).toBe('manager');
    });

    it('should handle user without name', async () => {
      const user: UserToProvision = {
        email: 'user@example.com',
        role: 'user',
      };

      (mockGHLClient.createUser as any).mockResolvedValue({
        id: 'user_789',
        email: user.email,
      });

      const result = await service.provisionUser(
        'location_123',
        user,
        mockGHLClient
      );

      expect(result.success).toBe(true);
      // Should use default name "User"
      expect(mockGHLClient.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'User',
        })
      );
    });

    it('should reject invalid email format', async () => {
      const user: UserToProvision = {
        email: 'invalid-email',
        role: 'user',
      };

      const result = await service.provisionUser(
        'location_123',
        user,
        mockGHLClient,
        testJobId
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email format');

      // Should not call GHL API
      expect(mockGHLClient.createUser).not.toHaveBeenCalled();
    });

    it('should handle GHL API errors gracefully', async () => {
      const user: UserToProvision = {
        email: 'test@example.com',
        role: 'user',
      };

      (mockGHLClient.createUser as any).mockRejectedValue(
        new Error('GHL API error: User already exists')
      );

      const result = await service.provisionUser(
        'location_123',
        user,
        mockGHLClient,
        testJobId
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('GHL API error');
      expect(result.invitationSent).toBe(false);

      // Verify failure was logged
      const logs = await prisma.provisioningLog.findMany({
        where: {
          jobId: testJobId,
          status: 'FAILED',
        },
      });
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should skip invitation if sendInvitation is false', async () => {
      const user: UserToProvision = {
        email: 'noinvite@example.com',
        role: 'user',
        sendInvitation: false,
      };

      (mockGHLClient.createUser as any).mockResolvedValue({
        id: 'user_noinvite',
        email: user.email,
      });

      const result = await service.provisionUser(
        'location_123',
        user,
        mockGHLClient
      );

      expect(result.success).toBe(true);
      expect(result.invitationSent).toBe(false);
    });
  });

  describe('provisionUsers', () => {
    it('should provision multiple users', async () => {
      const users: UserToProvision[] = [
        {
          email: 'user1@example.com',
          firstName: 'User',
          lastName: 'One',
          role: 'admin',
        },
        {
          email: 'user2@example.com',
          firstName: 'User',
          lastName: 'Two',
          role: 'manager',
        },
        {
          email: 'user3@example.com',
          role: 'user',
        },
      ];

      (mockGHLClient.createUser as any)
        .mockResolvedValueOnce({ id: 'user_1', email: users[0].email })
        .mockResolvedValueOnce({ id: 'user_2', email: users[1].email })
        .mockResolvedValueOnce({ id: 'user_3', email: users[2].email });

      const results = await service.provisionUsers(
        'location_123',
        users,
        mockGHLClient,
        testJobId
      );

      expect(results.length).toBe(3);
      expect(results.every((r) => r.success)).toBe(true);
      expect(results[0].userId).toBe('user_1');
      expect(results[1].userId).toBe('user_2');
      expect(results[2].userId).toBe('user_3');

      // Verify batch log was created
      const batchLogs = await prisma.provisioningLog.findMany({
        where: {
          jobId: testJobId,
          step: 'BATCH_USER_PROVISIONING_STARTED',
        },
      });
      expect(batchLogs.length).toBe(1);
    });

    it('should handle partial failures in batch provisioning', async () => {
      const users: UserToProvision[] = [
        { email: 'success@example.com', role: 'user' },
        { email: 'invalid-email', role: 'user' }, // Invalid email
        { email: 'another@example.com', role: 'user' },
      ];

      (mockGHLClient.createUser as any)
        .mockResolvedValueOnce({ id: 'user_success', email: users[0].email })
        .mockResolvedValueOnce({ id: 'user_another', email: users[2].email });

      const results = await service.provisionUsers(
        'location_123',
        users,
        mockGHLClient,
        testJobId
      );

      expect(results.length).toBe(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false); // Invalid email
      expect(results[2].success).toBe(true);

      // Verify completion log indicates partial failure
      const completionLogs = await prisma.provisioningLog.findMany({
        where: {
          jobId: testJobId,
          step: 'BATCH_USER_PROVISIONING_COMPLETED',
        },
      });
      expect(completionLogs.length).toBe(1);
      const details = completionLogs[0].detailsJson as any;
      expect(details.successCount).toBe(2);
      expect(details.failureCount).toBe(1);
    });

    it('should return empty array for empty user list', async () => {
      const results = await service.provisionUsers(
        'location_123',
        [],
        mockGHLClient
      );

      expect(results).toEqual([]);
      expect(mockGHLClient.createUser).not.toHaveBeenCalled();
    });
  });

  describe('parseCsvUsers', () => {
    it('should parse CSV with all fields', () => {
      const csv = `email,firstName,lastName,role
admin@example.com,John,Admin,admin
manager@example.com,Jane,Manager,manager
user@example.com,Bob,User,user`;

      const users = service.parseCsvUsers(csv);

      expect(users.length).toBe(3);
      expect(users[0]).toEqual({
        email: 'admin@example.com',
        firstName: 'John',
        lastName: 'Admin',
        role: 'admin',
        sendInvitation: true,
      });
      expect(users[1]).toEqual({
        email: 'manager@example.com',
        firstName: 'Jane',
        lastName: 'Manager',
        role: 'manager',
        sendInvitation: true,
      });
    });

    it('should parse CSV with email only', () => {
      const csv = `email
user1@example.com
user2@example.com`;

      const users = service.parseCsvUsers(csv);

      expect(users.length).toBe(2);
      expect(users[0].email).toBe('user1@example.com');
      expect(users[0].role).toBe('user'); // Default role
      expect(users[0].firstName).toBeUndefined();
    });

    it('should handle alternative column names', () => {
      const csv = `email,first_name,last_name,role
user@example.com,Test,User,admin`;

      const users = service.parseCsvUsers(csv);

      expect(users.length).toBe(1);
      expect(users[0].firstName).toBe('Test');
      expect(users[0].lastName).toBe('User');
    });

    it('should skip empty rows', () => {
      const csv = `email,role
user1@example.com,admin

user2@example.com,user
,`;

      const users = service.parseCsvUsers(csv);

      expect(users.length).toBe(2);
      expect(users[0].email).toBe('user1@example.com');
      expect(users[1].email).toBe('user2@example.com');
    });

    it('should default invalid roles to "user"', () => {
      const csv = `email,role
test@example.com,invalidrole`;

      const users = service.parseCsvUsers(csv);

      expect(users.length).toBe(1);
      expect(users[0].role).toBe('user');
    });

    it('should throw error for CSV without email column', () => {
      const csv = `name,role
John Doe,admin`;

      expect(() => service.parseCsvUsers(csv)).toThrow('CSV must have an "email" column');
    });

    it('should throw error for empty CSV', () => {
      const csv = '';

      expect(() => service.parseCsvUsers(csv)).toThrow('CSV must contain at least a header row');
    });

    it('should handle CSV with whitespace', () => {
      const csv = `  email  ,  firstName  ,  role
  user@example.com  ,  John  ,  admin  `;

      const users = service.parseCsvUsers(csv);

      expect(users.length).toBe(1);
      expect(users[0].email).toBe('user@example.com');
      expect(users[0].firstName).toBe('John');
      expect(users[0].role).toBe('admin');
    });
  });

  describe('assignUserToLocation', () => {
    it('should assign existing user to location', async () => {
      (mockGHLClient.getUser as any).mockResolvedValue({
        id: 'user_existing',
        email: 'existing@example.com',
        locationIds: ['location_1'],
      });

      const result = await service.assignUserToLocation(
        'user_existing',
        'location_2',
        'manager',
        mockGHLClient
      );

      expect(result).toBe(true);
      expect(mockGHLClient.getUser).toHaveBeenCalledWith('user_existing');
    });

    it('should handle errors when assigning user', async () => {
      (mockGHLClient.getUser as any).mockRejectedValue(
        new Error('User not found')
      );

      const result = await service.assignUserToLocation(
        'nonexistent_user',
        'location_2',
        'user',
        mockGHLClient
      );

      expect(result).toBe(false);
    });
  });
});
