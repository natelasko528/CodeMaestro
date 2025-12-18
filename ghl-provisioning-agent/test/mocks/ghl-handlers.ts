import { http, HttpResponse } from 'msw';

const GHL_API_BASE_URL = 'https://services.leadconnectorhq.com';

// Mock data
const mockLocations = [
  {
    id: 'loc_123',
    name: 'Test Location 1',
    companyId: 'company_456',
    address: '123 Main St',
    city: 'San Francisco',
    state: 'CA',
    country: 'US',
    postalCode: '94105',
    timezone: 'America/Los_Angeles',
  },
  {
    id: 'loc_789',
    name: 'Test Location 2',
    companyId: 'company_456',
    city: 'New York',
    state: 'NY',
    country: 'US',
  },
];

const mockUsers = [
  {
    id: 'user_111',
    name: 'John Doe',
    email: 'john@example.com',
    type: 'account' as const,
    role: 'admin',
    locationIds: ['loc_123'],
  },
  {
    id: 'user_222',
    name: 'Jane Smith',
    email: 'jane@example.com',
    type: 'agency' as const,
    role: 'user',
  },
];

const mockSnapshots = [
  {
    id: 'snap_001',
    name: 'Real Estate Template',
    description: 'Complete setup for real estate agencies',
    companyId: 'company_456',
    isPublic: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
  {
    id: 'snap_002',
    name: 'Automotive Template',
    description: 'Template for car dealerships',
    companyId: 'company_456',
    isPublic: false,
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-02-10T00:00:00Z',
  },
];

export const ghlHandlers = [
  // Locations endpoints
  http.get(`${GHL_API_BASE_URL}/locations`, ({ request }) => {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    // Check for valid token (not empty/invalid)
    const token = authHeader.replace('Bearer ', '');
    if (!token || token === 'invalid-token') {
      return HttpResponse.json(
        { error: 'Unauthorized', message: 'Invalid access token' },
        { status: 401 }
      );
    }

    return HttpResponse.json({ locations: mockLocations });
  }),

  http.get(`${GHL_API_BASE_URL}/locations/:locationId`, ({ params, request }) => {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const location = mockLocations.find((loc) => loc.id === params.locationId);

    if (!location) {
      return HttpResponse.json(
        { error: 'Not Found', message: 'Location not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json({ location });
  }),

  http.post(`${GHL_API_BASE_URL}/locations`, async ({ request }) => {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const body = (await request.json()) as any;

    const newLocation = {
      id: `loc_${Date.now()}`,
      companyId: 'company_456',
      ...body,
    };

    return HttpResponse.json({ location: newLocation }, { status: 201 });
  }),

  // Users endpoints
  http.get(`${GHL_API_BASE_URL}/users`, ({ request }) => {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    return HttpResponse.json({ users: mockUsers });
  }),

  http.get(`${GHL_API_BASE_URL}/users/:userId`, ({ params, request }) => {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const user = mockUsers.find((u) => u.id === params.userId);

    if (!user) {
      return HttpResponse.json(
        { error: 'Not Found', message: 'User not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json({ user });
  }),

  http.post(`${GHL_API_BASE_URL}/users`, async ({ request }) => {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const body = (await request.json()) as any;

    const newUser = {
      id: `user_${Date.now()}`,
      type: 'account' as const,
      ...body,
    };

    return HttpResponse.json({ user: newUser }, { status: 201 });
  }),

  // Snapshots endpoints
  http.get(`${GHL_API_BASE_URL}/snapshots`, ({ request }) => {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    return HttpResponse.json({ snapshots: mockSnapshots });
  }),

  http.get(`${GHL_API_BASE_URL}/snapshots/:snapshotId`, ({ params, request }) => {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const snapshot = mockSnapshots.find((s) => s.id === params.snapshotId);

    if (!snapshot) {
      return HttpResponse.json(
        { error: 'Not Found', message: 'Snapshot not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json({ snapshot });
  }),

  http.post(
    `${GHL_API_BASE_URL}/locations/:locationId/snapshot/:snapshotId`,
    ({ request }) => {
      const authHeader = request.headers.get('Authorization');

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return HttpResponse.json(
          { error: 'Unauthorized', message: 'Missing or invalid authorization header' },
          { status: 401 }
        );
      }

      return HttpResponse.json({ success: true });
    }
  ),

  // Contacts endpoints
  http.post(
    `${GHL_API_BASE_URL}/locations/:locationId/contacts`,
    async ({ request, params }) => {
      const authHeader = request.headers.get('Authorization');

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return HttpResponse.json(
          { error: 'Unauthorized', message: 'Missing or invalid authorization header' },
          { status: 401 }
        );
      }

      const body = (await request.json()) as any;

      const newContact = {
        id: `contact_${Date.now()}`,
        locationId: params.locationId as string,
        ...body,
      };

      return HttpResponse.json({ contact: newContact }, { status: 201 });
    }
  ),

  http.get(
    `${GHL_API_BASE_URL}/locations/:locationId/contacts/:contactId`,
    ({ params, request }) => {
      const authHeader = request.headers.get('Authorization');

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return HttpResponse.json(
          { error: 'Unauthorized', message: 'Missing or invalid authorization header' },
          { status: 401 }
        );
      }

      return HttpResponse.json({
        contact: {
          id: params.contactId,
          locationId: params.locationId,
          firstName: 'Test',
          lastName: 'Contact',
          email: 'test@example.com',
        },
      });
    }
  ),

  http.put(
    `${GHL_API_BASE_URL}/locations/:locationId/contacts/:contactId`,
    async ({ request, params }) => {
      const authHeader = request.headers.get('Authorization');

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return HttpResponse.json(
          { error: 'Unauthorized', message: 'Missing or invalid authorization header' },
          { status: 401 }
        );
      }

      const body = (await request.json()) as any;

      return HttpResponse.json({
        contact: {
          id: params.contactId,
          locationId: params.locationId,
          ...body,
        },
      });
    }
  ),

  http.delete(
    `${GHL_API_BASE_URL}/locations/:locationId/contacts/:contactId`,
    ({ request }) => {
      const authHeader = request.headers.get('Authorization');

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return HttpResponse.json(
          { error: 'Unauthorized', message: 'Missing or invalid authorization header' },
          { status: 401 }
        );
      }

      return new HttpResponse(null, { status: 204 });
    }
  ),
];
