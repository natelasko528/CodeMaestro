import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { ghlHandlers } from '../../../test/mocks/ghl-handlers';
import { GHLClient, GHLAPIError } from '../ghl-client';

const server = setupServer(...ghlHandlers);

describe('GHLClient', () => {
  const testAccessToken = 'test-access-token-123';
  let client: GHLClient;

  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  beforeEach(() => {
    client = new GHLClient(testAccessToken);
  });

  describe('constructor', () => {
    it('should create a client with access token', () => {
      expect(client).toBeInstanceOf(GHLClient);
    });

    it('should use custom base URL if provided', () => {
      const customClient = new GHLClient(testAccessToken, 'https://custom.api.com');
      expect(customClient).toBeInstanceOf(GHLClient);
    });
  });

  describe('getLocations', () => {
    it('should fetch all locations', async () => {
      const locations = await client.getLocations();

      expect(locations).toBeDefined();
      expect(Array.isArray(locations)).toBe(true);
      expect(locations.length).toBeGreaterThan(0);
      expect(locations[0]).toHaveProperty('id');
      expect(locations[0]).toHaveProperty('name');
    });

    it('should throw error with invalid token', async () => {
      const invalidClient = new GHLClient('invalid-token');

      await expect(invalidClient.getLocations()).rejects.toThrow(GHLAPIError);
    });
  });

  describe('getLocation', () => {
    it('should fetch a specific location by ID', async () => {
      const location = await client.getLocation('loc_123');

      expect(location).toBeDefined();
      expect(location.id).toBe('loc_123');
      expect(location.name).toBe('Test Location 1');
    });

    it('should throw 404 error for non-existent location', async () => {
      await expect(client.getLocation('loc_nonexistent')).rejects.toThrow(GHLAPIError);
    });
  });

  describe('createLocation', () => {
    it('should create a new location', async () => {
      const newLocation = await client.createLocation({
        name: 'New Test Location',
        address: '456 Oak St',
        city: 'Los Angeles',
        state: 'CA',
      });

      expect(newLocation).toBeDefined();
      expect(newLocation.id).toBeTruthy();
      expect(newLocation.name).toBe('New Test Location');
      expect(newLocation.companyId).toBeTruthy();
    });
  });

  describe('getUsers', () => {
    it('should fetch all users', async () => {
      const users = await client.getUsers();

      expect(users).toBeDefined();
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThan(0);
      expect(users[0]).toHaveProperty('id');
      expect(users[0]).toHaveProperty('email');
    });
  });

  describe('getUser', () => {
    it('should fetch a specific user by ID', async () => {
      const user = await client.getUser('user_111');

      expect(user).toBeDefined();
      expect(user.id).toBe('user_111');
      expect(user.name).toBe('John Doe');
      expect(user.email).toBe('john@example.com');
    });

    it('should throw 404 error for non-existent user', async () => {
      await expect(client.getUser('user_nonexistent')).rejects.toThrow(GHLAPIError);
    });
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      const newUser = await client.createUser({
        name: 'Bob Wilson',
        email: 'bob@example.com',
        type: 'account',
      });

      expect(newUser).toBeDefined();
      expect(newUser.id).toBeTruthy();
      expect(newUser.name).toBe('Bob Wilson');
      expect(newUser.email).toBe('bob@example.com');
    });
  });

  describe('getSnapshots', () => {
    it('should fetch all snapshots', async () => {
      const snapshots = await client.getSnapshots();

      expect(snapshots).toBeDefined();
      expect(Array.isArray(snapshots)).toBe(true);
      expect(snapshots.length).toBeGreaterThan(0);
      expect(snapshots[0]).toHaveProperty('id');
      expect(snapshots[0]).toHaveProperty('name');
    });
  });

  describe('getSnapshot', () => {
    it('should fetch a specific snapshot by ID', async () => {
      const snapshot = await client.getSnapshot('snap_001');

      expect(snapshot).toBeDefined();
      expect(snapshot.id).toBe('snap_001');
      expect(snapshot.name).toBe('Real Estate Template');
    });

    it('should throw 404 error for non-existent snapshot', async () => {
      await expect(client.getSnapshot('snap_nonexistent')).rejects.toThrow(GHLAPIError);
    });
  });

  describe('applySnapshot', () => {
    it('should apply a snapshot to a location', async () => {
      await expect(
        client.applySnapshot('loc_123', 'snap_001')
      ).resolves.not.toThrow();
    });
  });

  describe('createContact', () => {
    it('should create a new contact', async () => {
      const newContact = await client.createContact({
        locationId: 'loc_123',
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice@example.com',
        phone: '+15551234567',
      });

      expect(newContact).toBeDefined();
      expect(newContact.id).toBeTruthy();
      expect(newContact.firstName).toBe('Alice');
      expect(newContact.email).toBe('alice@example.com');
    });
  });

  describe('getContact', () => {
    it('should fetch a contact by ID', async () => {
      const contact = await client.getContact('loc_123', 'contact_456');

      expect(contact).toBeDefined();
      expect(contact.id).toBe('contact_456');
      expect(contact.locationId).toBe('loc_123');
    });
  });

  describe('updateContact', () => {
    it('should update a contact', async () => {
      const updated = await client.updateContact('loc_123', 'contact_456', {
        firstName: 'Updated',
        email: 'updated@example.com',
      });

      expect(updated).toBeDefined();
      expect(updated.firstName).toBe('Updated');
      expect(updated.email).toBe('updated@example.com');
    });
  });

  describe('deleteContact', () => {
    it('should delete a contact', async () => {
      await expect(
        client.deleteContact('loc_123', 'contact_456')
      ).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should throw GHLAPIError for unauthorized requests', async () => {
      const unauthClient = new GHLClient('');

      try {
        await unauthClient.getLocations();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(GHLAPIError);
        expect((error as GHLAPIError).statusCode).toBe(401);
      }
    });

    it('should include status code in error', async () => {
      try {
        await client.getLocation('nonexistent');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(GHLAPIError);
        expect((error as GHLAPIError).statusCode).toBe(404);
      }
    });
  });
});
