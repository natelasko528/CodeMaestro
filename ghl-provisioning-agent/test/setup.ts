import { beforeAll, afterEach, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { ghlHandlers } from './mocks/ghl-handlers';

// Setup MSW for mocking HTTP requests in tests
export const server = setupServer(...ghlHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
