import { decryptToken } from './encryption';
import prisma from './db';

const GHL_API_BASE_URL =
  process.env.GHL_API_BASE_URL || 'https://services.leadconnectorhq.com';

export interface GHLLocation {
  id: string;
  name: string;
  companyId: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  website?: string;
  timezone?: string;
}

export interface GHLUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  type: 'account' | 'agency';
  role?: string;
  locationIds?: string[];
}

export interface GHLSnapshot {
  id: string;
  name: string;
  description?: string;
  companyId: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GHLContact {
  id?: string;
  locationId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  customFields?: Record<string, any>;
}

interface GHLAPIErrorResponse {
  error: string;
  message?: string;
  statusCode?: number;
}

export class GHLAPIError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'GHL_API_ERROR') {
    super(message);
    this.name = 'GHLAPIError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class GHLClient {
  private baseUrl: string;
  private accessToken: string;

  constructor(accessToken: string, baseUrl?: string) {
    this.baseUrl = baseUrl || GHL_API_BASE_URL;
    this.accessToken = accessToken;
  }

  /**
   * Create a GHL client for a specific agency
   * Automatically retrieves and decrypts the access token
   */
  static async forAgency(agencyId: string): Promise<GHLClient> {
    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      select: {
        oauthAccessTokenEncrypted: true,
        tokenExpiresAt: true,
      },
    });

    if (!agency) {
      throw new GHLAPIError('Agency not found', 404, 'AGENCY_NOT_FOUND');
    }

    // Check if token is expired
    if (new Date() >= agency.tokenExpiresAt) {
      throw new GHLAPIError(
        'Access token expired. Please refresh token.',
        401,
        'TOKEN_EXPIRED'
      );
    }

    const accessToken = decryptToken(agency.oauthAccessTokenEncrypted);
    return new GHLClient(accessToken);
  }

  /**
   * Make authenticated request to GHL API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      let error: GHLAPIError;

      try {
        const errorData: GHLAPIErrorResponse = await response.json();
        error = new GHLAPIError(
          errorData.message || errorData.error || 'GHL API request failed',
          response.status,
          'GHL_API_ERROR'
        );
      } catch {
        error = new GHLAPIError(
          `GHL API request failed with status ${response.status}`,
          response.status,
          'GHL_API_ERROR'
        );
      }

      throw error;
    }

    // Handle 204 No Content (e.g., DELETE requests)
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  /**
   * Get locations for the authenticated company
   */
  async getLocations(): Promise<GHLLocation[]> {
    interface LocationsResponse {
      locations: GHLLocation[];
    }

    const data = await this.request<LocationsResponse>('/locations');
    return data.locations;
  }

  /**
   * Get a specific location by ID
   */
  async getLocation(locationId: string): Promise<GHLLocation> {
    interface LocationResponse {
      location: GHLLocation;
    }

    const data = await this.request<LocationResponse>(`/locations/${locationId}`);
    return data.location;
  }

  /**
   * Create a new location (sub-account)
   */
  async createLocation(locationData: Partial<GHLLocation>): Promise<GHLLocation> {
    interface CreateLocationResponse {
      location: GHLLocation;
    }

    const data = await this.request<CreateLocationResponse>('/locations', {
      method: 'POST',
      body: JSON.stringify(locationData),
    });

    return data.location;
  }

  /**
   * Get users for the authenticated company
   */
  async getUsers(): Promise<GHLUser[]> {
    interface UsersResponse {
      users: GHLUser[];
    }

    const data = await this.request<UsersResponse>('/users');
    return data.users;
  }

  /**
   * Get a specific user by ID
   */
  async getUser(userId: string): Promise<GHLUser> {
    interface UserResponse {
      user: GHLUser;
    }

    const data = await this.request<UserResponse>(`/users/${userId}`);
    return data.user;
  }

  /**
   * Create a new user
   */
  async createUser(userData: Partial<GHLUser>): Promise<GHLUser> {
    interface CreateUserResponse {
      user: GHLUser;
    }

    const data = await this.request<CreateUserResponse>('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    return data.user;
  }

  /**
   * Get snapshots available to the company
   */
  async getSnapshots(): Promise<GHLSnapshot[]> {
    interface SnapshotsResponse {
      snapshots: GHLSnapshot[];
    }

    const data = await this.request<SnapshotsResponse>('/snapshots');
    return data.snapshots;
  }

  /**
   * Get a specific snapshot by ID
   */
  async getSnapshot(snapshotId: string): Promise<GHLSnapshot> {
    interface SnapshotResponse {
      snapshot: GHLSnapshot;
    }

    const data = await this.request<SnapshotResponse>(`/snapshots/${snapshotId}`);
    return data.snapshot;
  }

  /**
   * Apply a snapshot to a location
   */
  async applySnapshot(locationId: string, snapshotId: string): Promise<void> {
    await this.request(`/locations/${locationId}/snapshot/${snapshotId}`, {
      method: 'POST',
    });
  }

  /**
   * Create a contact in a location
   */
  async createContact(contact: GHLContact): Promise<GHLContact> {
    interface CreateContactResponse {
      contact: GHLContact;
    }

    const data = await this.request<CreateContactResponse>(
      `/locations/${contact.locationId}/contacts`,
      {
        method: 'POST',
        body: JSON.stringify(contact),
      }
    );

    return data.contact;
  }

  /**
   * Get contact by ID
   */
  async getContact(locationId: string, contactId: string): Promise<GHLContact> {
    interface ContactResponse {
      contact: GHLContact;
    }

    const data = await this.request<ContactResponse>(
      `/locations/${locationId}/contacts/${contactId}`
    );
    return data.contact;
  }

  /**
   * Update a contact
   */
  async updateContact(
    locationId: string,
    contactId: string,
    updates: Partial<GHLContact>
  ): Promise<GHLContact> {
    interface UpdateContactResponse {
      contact: GHLContact;
    }

    const data = await this.request<UpdateContactResponse>(
      `/locations/${locationId}/contacts/${contactId}`,
      {
        method: 'PUT',
        body: JSON.stringify(updates),
      }
    );

    return data.contact;
  }

  /**
   * Delete a contact
   */
  async deleteContact(locationId: string, contactId: string): Promise<void> {
    await this.request(`/locations/${locationId}/contacts/${contactId}`, {
      method: 'DELETE',
    });
  }
}

export default GHLClient;
