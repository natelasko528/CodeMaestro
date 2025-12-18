# 09 — TESTING & QA

## Overview

Comprehensive testing strategy covering unit, integration, and end-to-end testing with quality gates to ensure reliability, security, and correctness of the GHL provisioning agent.

---

## Test Types & Tools

### Unit Testing
- **Framework**: Vitest
- **Scope**: Utilities, API helpers, validation functions, data transformers
- **Coverage Target**: 80% minimum for critical paths
- **Key Areas**:
  - Token encryption/decryption utilities
  - API request builders and validators
  - Data transformation functions
  - Error handling and retry logic
  - SSE message parsing
  - Job status calculations

### Integration Testing
- **Framework**: Vitest with Mock Service Worker (MSW)
- **Scope**: API routes, service layer interactions, database operations
- **Mock GHL API**: MSW handlers for all GHL API endpoints
- **Test Database**: In-memory SQLite or test instances
- **Key Areas**:
  - OAuth token exchange flow
  - Job creation and status tracking
  - Batch import processing
  - SSE stream initialization
  - Error recovery paths
  - Database transaction integrity

### End-to-End Testing
- **Framework**: Playwright
- **Scope**: Critical user flows across browsers
- **Execution Environment**: Staging or containerized test environment
- **Browsers**: Chromium, Firefox (Safari optional)
- **Key Areas**:
  - Complete OAuth connection flow
  - Full provisioning workflow (UI → API → GHL → Database)
  - Real-time SSE stream monitoring
  - Error scenarios and recovery
  - Token refresh during long operations

### Linting & Code Quality
- **Linter**: ESLint with TypeScript support
- **Formatter**: Prettier (auto-format on commit)
- **Type Checking**: TypeScript strict mode
- **Static Analysis**: ESLint plugins for security and best practices

---

## Critical Test Scenarios

### 1. OAuth Connection Flow
**Objective**: Verify secure OAuth handshake with GHL

```
Given: User initiates OAuth connection
When: User approves permissions in GHL OAuth dialog
Then:
  - Authorization code is exchanged for tokens
  - Tokens stored securely (encrypted at rest)
  - User profile synced from GHL
  - Connection status visible in UI
  - Token refresh schedule established
```

**Unit Tests**:
- `oauthCodeExchange()` returns valid tokens
- `encryptToken()` and `decryptToken()` are inverses
- Invalid auth codes are rejected with proper error

**Integration Tests**:
- Full OAuth flow with mocked GHL endpoint
- Token persistence across requests
- Database audit trail created

**E2E Tests**:
- User completes OAuth dialog
- Connection visible in settings
- Token refresh happens without user action

---

### 2. Complete Provisioning (Success Path)
**Objective**: End-to-end successful provisioning from UI to GHL

```
Given: Connected GHL account
When: User initiates provisioning with valid data
Then:
  - Job created in database with unique ID
  - GHL API calls made in correct sequence
  - Contacts imported successfully
  - Custom fields synced
  - User receives status updates via SSE
  - Job marked as completed
```

**Unit Tests**:
- `validateProvisioningInput()` accepts valid data
- `buildGHLBatchRequest()` creates correct payload
- Job status transitions are valid
- SSE event generation is correct

**Integration Tests**:
- Complete provisioning with mocked GHL API
- Database state verified after each step
- Transaction rollback on failure
- Audit logs created for all operations

**E2E Tests**:
- User initiates provisioning from UI
- Real-time status updates visible
- Final results displayed correctly
- Success confirmation sent

---

### 3. Failed API Call with Retry
**Objective**: Verify resilience to transient failures

```
Given: API call fails temporarily (e.g., 429 Too Many Requests)
When: Configured retry logic triggers
Then:
  - Exponential backoff applied (1s, 2s, 4s, 8s, ...)
  - Max retries respected (default: 3)
  - Jitter added to prevent thundering herd
  - Final failure after retries exhausted
  - Error logged with context and stack trace
```

**Unit Tests**:
- `retryWithBackoff()` calculates correct delays
- Jitter is within acceptable range
- Max retries enforced
- Exponential calculation correct (2^n)

**Integration Tests**:
- Simulated API failures with proper status codes
- Retry behavior verified in logs
- Eventual success after transient failure
- Circuit breaker prevents cascade

**E2E Tests**:
- Provisioning succeeds despite transient API failures
- User does not need to retry manually
- Error count in UI matches actual failures

---

### 4. Token Expiration and Refresh
**Objective**: Seamless token refresh without user intervention

```
Given: OAuth token approaching expiration
When: Refresh token validation triggers or API returns 401
Then:
  - New tokens obtained from GHL using refresh token
  - Old tokens replaced atomically
  - In-flight requests completed with new token
  - User session remains uninterrupted
  - Audit trail records refresh event
```

**Unit Tests**:
- `isTokenExpired()` correctly calculates expiration
- `refreshToken()` properly exchanges refresh token
- Token replacement is atomic (no partial updates)
- Refresh token rotation handled if provided

**Integration Tests**:
- Token expiration triggers refresh automatically
- Multiple concurrent requests use refreshed token
- Failed refresh attempts proper error handling
- Database consistency after refresh

**E2E Tests**:
- Long-running provisioning completes despite token expiration
- User not logged out during refresh
- No visible glitches in UI

---

### 5. Invalid Input Handling
**Objective**: Robust validation and error messages

```
Given: User submits invalid or malicious input
When: Input validation occurs (client + server)
Then:
  - Input rejected with specific error message
  - XSS attempts sanitized or rejected
  - SQL injection attempts prevented
  - Rate limits enforced
  - Error logged for security review
```

**Unit Tests**:
- `validateEmail()` rejects invalid formats
- `validatePhoneNumber()` handles variants
- `sanitizeCSV()` removes/escapes dangerous content
- `validateProvisioningConfig()` enforces schema
- Edge cases: null, undefined, empty strings, oversized payloads

**Integration Tests**:
- API endpoint rejects invalid JSON
- CSV parsing handles malformed files
- SQL parameterization prevents injection
- Rate limiting prevents brute force
- CORS validation prevents unauthorized origins

**E2E Tests**:
- UI prevents submission of invalid data
- Server-side validation catches bypasses
- Error messages helpful and non-revealing
- No application crash from bad input

---

### 6. Concurrent Jobs
**Objective**: Handle multiple provisioning jobs simultaneously

```
Given: Multiple concurrent provisioning requests
When: Jobs processed in parallel
Then:
  - Each job maintains isolation
  - Database transactions prevent race conditions
  - SSE streams routed to correct clients
  - Resource limits respected (memory, connections)
  - No job interference or data corruption
```

**Unit Tests**:
- Job status tracking thread-safe
- Database locks acquired correctly
- SSE message routing by client ID works
- Resource pool limits enforced

**Integration Tests**:
- 10+ concurrent jobs processed simultaneously
- Database consistency verified across jobs
- No deadlocks or race conditions
- Memory usage stays within bounds
- Connection pool exhaustion prevented

**E2E Tests**:
- Multiple users can provision simultaneously
- Each user sees only their job status
- No cross-contamination of job data
- All jobs complete successfully

---

### 7. SSE Stream Connection
**Objective**: Reliable real-time status updates

```
Given: User connected to SSE stream
When: Job status updates occur
Then:
  - Update received within 500ms
  - Connection resilient to network interruptions
  - Auto-reconnect with exponential backoff
  - No duplicate messages
  - Clean disconnect on completion
```

**Unit Tests**:
- `parseSSEMessage()` correctly parses event format
- `generateSSEEvent()` creates valid format
- Retry delay calculation correct
- Message deduplication logic works

**Integration Tests**:
- SSE endpoint sends correct headers
- Keep-alive pings prevent timeout
- Simulated network interruption triggers reconnect
- No messages lost on reconnect
- Client cleanup on disconnect

**E2E Tests**:
- Real-time status visible during provisioning
- Reconnects automatically after network failure
- Final completion event received
- No hanging connections after completion

---

## Mock GHL API with MSW

### Setup

```typescript
// handlers/ghl.handlers.ts
import { rest } from 'msw'

export const ghlHandlers = [
  // OAuth endpoints
  rest.post('https://api.gohighlevel.com/oauth/token', (req, res, ctx) => {
    return res(ctx.json({
      access_token: 'mock_access_token_123',
      refresh_token: 'mock_refresh_token_456',
      expires_in: 3600,
      token_type: 'Bearer'
    }))
  }),

  // Contact endpoints
  rest.post('https://api.gohighlevel.com/v1/contacts', (req, res, ctx) => {
    return res(ctx.json({
      id: 'contact_123',
      firstName: req.body.firstName,
      email: req.body.email,
      status: 'created'
    }))
  }),

  rest.get('https://api.gohighlevel.com/v1/contacts/:id', (req, res, ctx) => {
    return res(ctx.json({
      id: req.params.id,
      status: 'active'
    }))
  }),

  // Batch import endpoints
  rest.post('https://api.gohighlevel.com/v1/batch/contacts/import', (req, res, ctx) => {
    return res(ctx.json({
      jobId: 'batch_job_789',
      status: 'processing',
      total: req.body.contacts.length,
      processed: 0
    }))
  }),

  rest.get('https://api.gohighlevel.com/v1/batch/jobs/:jobId', (req, res, ctx) => {
    return res(ctx.json({
      jobId: req.params.jobId,
      status: 'completed',
      total: 1000,
      processed: 1000,
      failed: 0,
      completedAt: new Date().toISOString()
    }))
  }),
]
```

### Test Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import setupServer from 'msw/node'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
  },
})

// test/setup.ts
import { setupServer } from 'msw/node'
import { ghlHandlers } from './handlers/ghl.handlers'

export const server = setupServer(...ghlHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

---

## Test Coverage Standards

### Unit Tests
- Minimum 80% line coverage
- All error paths tested
- Edge cases covered (null, undefined, empty, oversized)
- Boundary conditions validated

### Integration Tests
- All API routes tested
- Happy path and error paths
- Database state verified
- Transaction integrity confirmed

### E2E Tests
- Critical user flows (minimum 3 major scenarios)
- Cross-browser compatibility (Chromium, Firefox)
- Mobile responsive design
- Accessibility compliance (WCAG 2.1 AA)

---

## Quality Gates

### Pre-Commit (Local)
```bash
npm run lint    # ESLint must pass
npm run type-check  # TypeScript must pass
npm run test    # Unit tests must pass
```

### Pre-Push (GitHub)
```bash
npm run test    # All unit/integration tests pass
npm run lint    # No ESLint violations
npm run build   # Build must succeed
```

### Continuous Integration (GitHub Actions)
```yaml
- Run all tests with coverage report
- Enforce coverage thresholds (80% minimum)
- ESLint + Prettier verification
- TypeScript strict mode check
- Security vulnerability scan
- E2E smoke tests on staging
```

### Requirements for Merge
- [ ] All unit tests passing (>80% coverage)
- [ ] All integration tests passing
- [ ] No TypeScript errors
- [ ] ESLint clean (zero violations)
- [ ] Prettier formatted
- [ ] Code review approved
- [ ] E2E smoke tests passed
- [ ] Security scan passed

---

## Test Data & Fixtures

### OAuth Test Data
```json
{
  "clientId": "test-client-id",
  "clientSecret": "test-client-secret",
  "redirectUri": "http://localhost:3000/callback",
  "validCode": "auth_code_valid_123",
  "invalidCode": "auth_code_invalid_456",
  "accessToken": "access_token_test_789",
  "refreshToken": "refresh_token_test_012"
}
```

### Contact Test Data
```json
{
  "valid": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phoneNumber": "+1234567890"
  },
  "invalid": {
    "firstName": "",
    "email": "not-an-email",
    "phoneNumber": "invalid"
  }
}
```

### Provisioning Config Test Data
```json
{
  "valid": {
    "businessName": "ACME Corp",
    "industry": "Technology",
    "timezone": "UTC",
    "estimatedContacts": 5000,
    "customFields": [
      { "name": "Department", "type": "text" }
    ]
  }
}
```

---

## Test Execution

### Running Tests Locally

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/utils/__tests__/token.test.ts

# Run with coverage report
npm test -- --coverage

# Run E2E tests (requires app running)
npm run test:e2e

# Run specific E2E test
npx playwright test --grep "OAuth"

# Watch mode for development
npm test -- --watch
```

### Running Tests in CI

```bash
# Full test suite with coverage
npm run test:ci

# E2E tests against staging
npm run test:e2e:staging

# Security audit
npm audit
npm run security-check
```

---

## Error Handling & Debugging

### Test Debugging
```typescript
// Use console.log() in tests (visible with --reporter=verbose)
console.log('Debug info:', value)

// Use debugger in Node
node --inspect-brk ./node_modules/.bin/vitest

// VS Code launch configuration
{
  "type": "node",
  "request": "launch",
  "program": "${workspaceFolder}/node_modules/.bin/vitest",
  "args": ["--inspect-brk"],
  "console": "integratedTerminal"
}
```

### E2E Test Debugging
```bash
# Run with UI mode
npx playwright test --ui

# Debug specific test
npx playwright test --debug --grep "OAuth"

# Generate trace for failed test
npx playwright test --trace on
```

---

## Continuous Monitoring

### Test Performance Metrics
- Average test execution time
- Coverage trends
- Flaky test detection
- Regression analysis

### Tools
- GitHub Actions for CI/CD
- Codecov for coverage tracking
- Sentry for error monitoring
- New Relic for APM

---

## Coach Rule

The Coach blocks task completion until:
1. ✅ All unit tests pass (`npm test`)
2. ✅ No TypeScript errors (`npm run type-check`)
3. ✅ ESLint passes with zero violations (`npm run lint`)
4. ✅ Code coverage meets 80% minimum threshold
5. ✅ E2E smoke tests pass on staging environment
6. ✅ No security vulnerabilities in dependencies
7. ✅ All critical test scenarios verified

When any gate fails, the Coach provides specific error output and blocks progression until resolved.

---

## Tool Allowlist (Safe Commands)

```bash
# Package managers
npm test
npm run lint
npm run type-check
npm run build
npm run test:coverage
npm run test:e2e

pnpm test
pnpm lint

# Testing frameworks
vitest
playwright test

# Code quality
eslint
prettier
typescript

# Build tools
tsc
vite
```

---

## Appendix: Test Environment Setup

### Prerequisites
- Node.js 18+ (use .nvmrc)
- npm 9+ or pnpm 8+
- SQLite 3+ (for test DB)
- Chrome/Firefox (for E2E)

### Installation
```bash
npm install

# Install browser binaries for Playwright
npx playwright install

# Generate test database
npm run db:setup:test
```

### Environment Variables (Test)
```bash
DATABASE_URL=sqlite:///:memory:
GHL_API_BASE_URL=https://api.gohighlevel.com
GHL_CLIENT_ID=test-client-id
GHL_CLIENT_SECRET=test-client-secret
NODE_ENV=test
LOG_LEVEL=debug
```

---

## References

- [Vitest Documentation](https://vitest.dev/)
- [Mock Service Worker](https://mswjs.io/)
- [Playwright Testing](https://playwright.dev/docs/intro)
- [ESLint Configuration](https://eslint.org/docs/user-guide/configuring)
- [TypeScript Testing Guide](https://www.typescriptlang.org/)
