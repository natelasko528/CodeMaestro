# 02 — ARCHITECTURE

## Chosen Stack

### Frontend
- **Framework**: Next.js 14 App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **State Management**: React Context + React Query (for server state)
- **Real-time Updates**: Server-Sent Events (SSE)

### Backend
- **Framework**: Next.js API Routes
- **Language**: TypeScript
- **Environment**: Node.js (Vercel runtime)
- **Real-time**: Server-Sent Events (SSE) endpoints

### Database
- **System**: PostgreSQL
- **Hosting**: Vercel Postgres (free tier)
- **ORM**: Prisma
- **Migrations**: Prisma Migrate

### Authentication
- **Framework**: NextAuth.js v5
- **Primary Method**: GHL OAuth 2.0
- **Session Management**: JWT + Secure HTTP-only cookies
- **Authorization**: Role-based Access Control (RBAC)

### AI Services
- **Provider**: OpenAI API
- **Model**: GPT-4o-mini
- **Use Cases**: Provisioning prompt generation, workflow automation, GHL configuration suggestions

### Task Queue
- **Type**: Database-based (custom implementation)
- **Storage**: PostgreSQL job table
- **Processing**: API route polling + background job handler
- **No external dependencies**: Cost reduction, MVP simplification

### Real-time Communication
- **Protocol**: Server-Sent Events (SSE)
- **Use Cases**: Job status updates, provisioning progress, error notifications
- **Alternative not chosen**: WebSocket (complexity overhead for one-way push)

### Hosting
- **Platform**: Vercel (free tier)
- **Deployment**: Git-based (GitHub integration)
- **Database**: Vercel Postgres (free tier)
- **Environment Variables**: Vercel env management

---

## System Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        Browser["Web Browser"]
        Client["Next.js Client (React)"]
    end

    subgraph "Frontend Application"
        Pages["Pages & Routing<br/>(App Router)"]
        Components["UI Components<br/>(shadcn/ui)"]
        Hooks["Custom Hooks<br/>(useQuery, useMutation)"]
        Utils["Utilities & Services"]
    end

    subgraph "Backend Application"
        API["API Routes<br/>(/api/*)"]
        Auth["Auth Handler<br/>(NextAuth.js)"]
        Services["Business Logic<br/>(GHL, AI, Job)")
        Queue["Job Queue<br/>(Database-based)"]
        SSE["SSE Endpoints<br/>(Real-time)"]
    end

    subgraph "Data Layer"
        DB[(PostgreSQL<br/>Vercel Postgres)]
        Cache["Query Cache<br/>(React Query)"]
    end

    subgraph "External Services"
        GHL["GHL OAuth<br/>(Authentication)"]
        OpenAI["OpenAI API<br/>(GPT-4o-mini)"]
        GHLApi["GHL API<br/>(Provisioning)"]
    end

    Browser -->|HTTP/HTTPS| Client
    Client -->|Renders| Pages
    Pages -->|Renders| Components
    Components -->|Use| Hooks
    Hooks -->|Call| Utils
    Utils -->|HTTP Requests| API

    API -->|Authenticates| Auth
    Auth -->|Verifies with| GHL
    Auth -->|Sets Session| Client

    API -->|Uses| Services
    Services -->|Reads/Writes| DB
    Services -->|Enqueues| Queue
    Queue -->|Polls| Services

    Services -->|Calls| OpenAI
    Services -->|Calls| GHLApi

    Hooks -->|Cache| Cache
    Cache -->|From| DB

    Utils -->|Subscribe to| SSE
    SSE -->|Streams from| Services
```

---

## Module Breakdown

### Frontend Modules

#### Pages & Routing (`app/`)
- **Dashboard**: Overview of provisioning jobs, status, metrics
- **Provisioning**: Interactive provisioning workflow with step-by-step UI
- **Jobs**: Job history, logs, and detailed status tracking
- **Settings**: API key management, GHL account linking, preferences
- **Auth**: Login/callback pages (NextAuth.js managed)

#### Components (`components/`)
- **Common**: Buttons, inputs, modals, cards, layouts (shadcn/ui-based)
- **Dashboard**: StatsCard, JobsList, ProgressChart
- **Provisioning**: WorkflowStepper, ConfigForm, PreviewPanel
- **Jobs**: JobTable, LogViewer, StatusBadge
- **Auth**: LoginButton, LogoutButton, UserMenu

#### Hooks (`hooks/`)
- `useAuth`: Session management and authentication state
- `useProvisioning`: Provisioning job creation and management
- `useJobs`: Fetch and filter job history
- `useSSE`: Subscribe to real-time job updates
- `useQuery`: React Query hooks for server state
- `useMutation`: React Query hooks for mutations

#### Services (`lib/`)
- `api-client.ts`: Typed fetch wrapper for API routes
- `auth.ts`: NextAuth.js configuration and helpers
- `sse-client.ts`: SSE connection management
- `validators.ts`: Zod schemas for client-side validation

---

### Backend Modules

#### API Routes (`api/`)
- **`/api/auth/*`**: NextAuth.js dynamic routes (login, callback, signout)
- **`/api/provisioning`**:
  - `POST`: Create new provisioning job
  - `GET`: List user's provisioning jobs
  - `PATCH /[id]`: Update job status/details
- **`/api/jobs`**:
  - `GET /[id]`: Get job details and logs
  - `DELETE /[id]`: Cancel or delete job
- **`/api/queue`**:
  - `GET`: Poll pending jobs (internal use)
  - `POST`: Enqueue new job (internal)
- **`/api/sse/stream`**: Server-Sent Events endpoint for real-time updates
- **`/api/config`**: Fetch GHL configuration schema and validation rules
- **`/api/health`**: Health check endpoint

#### Services (`lib/server/`)
- **`auth.ts`**: NextAuth.js providers, callbacks, JWT configuration
- **`db.ts`**: Prisma client and connection pooling
- **`queue.ts`**: Job enqueue/dequeue logic, processing orchestration
- **`ghl-service.ts`**: GHL API integration, account verification, provisioning logic
- **`ai-service.ts`**: OpenAI integration, prompt engineering, suggestion generation
- **`provisioning-engine.ts`**: Core provisioning workflow orchestration
- **`sse-manager.ts`**: SSE connection tracking and broadcast logic
- **`validators.ts`**: Zod schemas for server-side validation

#### Database Models (`prisma/schema.prisma`)
- **User**: GHL account holders, OAuth profile data
- **ProvisioningJob**: Job metadata, status, progress
- **JobLog**: Detailed step logs and error tracking
- **JobQueue**: Pending/processing jobs for async handling
- **GHLAccount**: Cached GHL account info and credentials
- **AIPromptCache**: Cache of AI-generated prompts for cost optimization

---

## Data Models

### Core Tables

#### `user`
```sql
id → UUID
ghlAccountId → String (unique)
email → String (unique)
name → String
image → URL
createdAt → DateTime
updatedAt → DateTime
```

#### `provisioning_job`
```sql
id → UUID
userId → UUID (FK)
status → enum(PENDING, PROCESSING, SUCCESS, FAILED, CANCELLED)
progress → Int (0-100)
totalSteps → Int
completedSteps → Int
ghlAccountId → String
config → JSON (provisioning config)
createdAt → DateTime
updatedAt → DateTime
completedAt → DateTime (nullable)
```

#### `job_log`
```sql
id → UUID
jobId → UUID (FK)
step → Int
stepName → String
status → enum(PENDING, RUNNING, SUCCESS, FAILED)
message → String
error → String (nullable)
duration → Int (milliseconds)
createdAt → DateTime
```

#### `job_queue`
```sql
id → UUID
jobId → UUID (FK)
status → enum(PENDING, PROCESSING, COMPLETED, FAILED)
nextRetry → DateTime (nullable)
attempts → Int
maxAttempts → Int
payload → JSON
createdAt → DateTime
updatedAt → DateTime
```

---

## Architecture Patterns

### Request Flow: Creating a Provisioning Job

1. **User Action**: User fills provisioning form in browser
2. **Validation**: Client-side validation with Zod
3. **API Call**: `POST /api/provisioning` with TypeScript types
4. **Authentication**: NextAuth.js middleware verifies session
5. **Server Validation**: Server-side Zod validation
6. **Job Creation**: Insert into `provisioning_job` and `job_queue` tables
7. **Response**: Return job ID and initial status to client
8. **Background Processing**: Queue processor picks up job, executes steps
9. **Real-time Updates**: SSE stream pushes progress to client
10. **Completion**: Job marked complete, final status persisted

### Real-time Update Flow

1. **Client**: Subscribes to SSE `/api/sse/stream?jobId=xxx`
2. **Server**: Adds connection to SSE manager's active connections
3. **Background Job**: Updates job status in database
4. **Broadcast**: SSE manager sends update to all subscribed clients
5. **Client**: React state updates, UI re-renders
6. **Cleanup**: Client unsubscribes when component unmounts

---

## Deployment Architecture

### Environment: Vercel (Free Tier)

**Regions**: Vercel automatically selects closest region

**Resources**:
- Compute: Vercel Serverless Functions (Next.js on Node.js runtime)
- Database: Vercel Postgres (1 GB storage, 4 GB bandwidth free)
- Environment Variables: Vercel dashboard or `.env.local`

**CI/CD**:
- Git push to main/branch triggers automatic deployment
- Build: `npm run build` (Next.js compilation)
- Tests: Optional pre-deployment test run
- Preview: Auto-generated preview URLs for PRs

**Environment Setup**:
```
DATABASE_URL=postgresql://...
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=<secure-random-string>
GHL_OAUTH_ID=...
GHL_OAUTH_SECRET=...
OPENAI_API_KEY=...
```

---

## ADRs (Architectural Decision Records)

### ADR-001: Next.js 14 App Router for Full-Stack Application

**Status**: Accepted

**Context**:
GHL provisioning agent requires seamless integration between frontend UI and backend API logic. Team has JavaScript/TypeScript expertise. Rapid iteration and deployment are critical for MVP.

**Decision**:
Use Next.js 14 with App Router as the unified frontend and backend framework.

**Rationale**:
1. **Full-stack JavaScript**: Single language across frontend and backend reduces cognitive load
2. **API Routes**: No separate API server needed, reducing infrastructure complexity
3. **Type Safety**: TypeScript throughout the entire stack
4. **File-based Routing**: Intuitive structure mirrors URL patterns
5. **Vercel Deployment**: Native integration, automatic optimizations
6. **Built-in Optimizations**: Image optimization, code splitting, ISR out-of-the-box
7. **Server Components**: Can fetch data directly in components, reducing client-side complexity
8. **Fast Iteration**: Hot reload in development, rapid feedback loop

**Trade-offs**:
- **Drawback**: Not ideal if backend and frontend scale independently (unlikely for MVP)
- **Drawback**: Node.js runtime dependency (acceptable for Vercel free tier)

**Alternatives Considered**:
- **React + Express.js**: More separation of concerns, but additional infrastructure overhead
- **Next.js Pages Router**: App Router is the modern standard, better future compatibility
- **Fastify + React SPA**: More complexity, separate deployments

---

### ADR-002: PostgreSQL with Vercel Postgres for Relational Data

**Status**: Accepted

**Context**:
GHL provisioning agent has structured, relational data (users, jobs, logs). SQL database ensures data integrity and ACID guarantees. Vercel Postgres is included in free tier.

**Decision**:
Use PostgreSQL as the primary database, hosted on Vercel Postgres.

**Rationale**:
1. **Relational Data Model**: User → ProvisioningJob → JobLog relationships are natural and require JOINs
2. **ACID Guarantees**: Critical for job integrity (prevent duplicate processing, ensure state consistency)
3. **Free Tier**: Vercel Postgres offers 1 GB storage + 4 GB bandwidth free
4. **Native Vercel Integration**: Zero configuration, automatic backups, simple connection pooling
5. **Prisma ORM**: Excellent TypeScript support, type-safe queries, automatic migrations
6. **Scalability**: PostgreSQL scales well, can add read replicas later
7. **Complex Queries**: Support for advanced queries (window functions, CTEs) for analytics

**Trade-offs**:
- **Drawback**: Not ideal for unstructured data (acceptable, job configs stored as JSON columns)
- **Drawback**: Overkill for simple key-value storage (no use case in this app)

**Alternatives Considered**:
- **MongoDB**: No relational structure benefits, JSON storage not sufficient advantage
- **SQLite**: Good for development, but lacks production-grade concurrency handling
- **NoSQL (Firestore, DynamoDB)**: Higher latency for relational queries, more expensive

---

### ADR-003: Database-Based Job Queue Instead of Redis for MVP

**Status**: Accepted

**Context**:
MVP requires asynchronous job processing (long-running provisioning tasks). Redis is traditional choice, but adds infrastructure complexity and cost. Database is already required, job volumes are low (MVP).

**Decision**:
Implement custom database-based job queue using PostgreSQL.

**Rationale**:
1. **Zero Additional Infrastructure**: Leverage existing database, no Redis deployment
2. **Cost**: Free (PostgreSQL already included), no additional service fees
3. **Simplicity**: Single source of truth, easier debugging and monitoring
4. **MVP Sufficient**: Expected low job volume (hundreds/day at MVP scale)
5. **Visibility**: Job queue stored in database, easily queryable for analytics/debugging
6. **ACID Guarantees**: Database transactions prevent race conditions and duplicate processing
7. **No Network I/O**: Slightly faster than Redis over network
8. **Persistence Guaranteed**: Jobs survive crashes (durable before processing)

**Implementation Details**:
- `job_queue` table with status enum: PENDING → PROCESSING → COMPLETED/FAILED
- Polling mechanism in API route or serverless function
- Atomic UPDATE with WHERE clause to claim jobs (prevents concurrent processing)
- Exponential backoff for retries
- Automatic cleanup of old completed jobs

**Transition Path**:
- When job volume exceeds thousands/day, migrate to Redis without code changes
- Queue abstraction layer allows swap-out: `IJobQueue` interface

**Trade-offs**:
- **Drawback**: Polling has slight latency vs. push model (acceptable, 10-second poll is fine)
- **Drawback**: Not optimized for queue systems (PostgreSQL not specifically designed for this)
- **Drawback**: Scalability ceiling before Redis becomes necessary

**Alternatives Considered**:
- **Redis**: Unnecessary cost and infrastructure for MVP volumes
- **AWS SQS**: No free tier, pay-per-request pricing, overkill for initial scale
- **Bull/RabbitMQ**: Requires separate service, more complexity
- **Vercel Functions with Cron**: Limited control, no guaranteed execution, not suitable for job orchestration

---

### ADR-004: NextAuth.js v5 with GHL OAuth 2.0 for Authentication

**Status**: Accepted

**Context**:
GHL provisioning agent is GHL-specific tool. Users authenticate via GHL accounts. OAuth 2.0 is industry standard. NextAuth.js simplifies OAuth integration.

**Decision**:
Use NextAuth.js v5 with GHL OAuth 2.0 as primary authentication method.

**Rationale**:
1. **GHL Ecosystem**: GHL OAuth is native to target audience (GHL users)
2. **Reduced Auth Burden**: No need to store passwords, manage password reset, 2FA
3. **Developer Experience**: NextAuth.js abstracts OAuth complexity
4. **Security**: Industry-standard OAuth 2.0 flow, secure token handling
5. **Session Management**: Automatic JWT and cookie-based sessions
6. **Type Safety**: NextAuth.js with TypeScript provides excellent type definitions
7. **Extensible**: Easy to add additional providers later (Google, GitHub)
8. **RBAC Ready**: Built-in callbacks for role-based access control

**Implementation**:
- GHL OAuth provider configured in `auth.ts`
- JWT strategy for stateless sessions
- Secure HTTP-only cookies for token storage
- Session callback adds GHL account info to session

**Trade-offs**:
- **Drawback**: Requires GHL OAuth setup and credentials
- **Drawback**: Relies on GHL OAuth availability

**Alternatives Considered**:
- **Auth0**: Good solution, but adds third-party dependency and cost
- **Manual OAuth**: Reinventing the wheel, security risks
- **Simple JWT**: No refresh token handling, poor UX
- **Magic Links**: Good UX, but requires email infrastructure

---

### ADR-005: OpenAI GPT-4o-mini for AI-Powered Provisioning

**Status**: Accepted

**Context**:
GHL provisioning is complex, with many configuration options. AI can help generate provisioning prompts, suggest workflows, and explain configurations. GPT-4o-mini offers good balance of capability and cost.

**Decision**:
Use OpenAI API with GPT-4o-mini model for AI features.

**Rationale**:
1. **Cost Efficiency**: `gpt-4o-mini` is significantly cheaper than full GPT-4o, still highly capable
2. **Capability**: Excellent at understanding GHL domain, generating valid configurations
3. **Reliability**: OpenAI API is stable, well-documented, widely used
4. **No Training**: No need for fine-tuning, general-purpose models work well
5. **Easy Integration**: Simple HTTP API, easy to integrate into Node.js backend
6. **Caching Opportunity**: Can cache common prompts, reduce API calls
7. **Error Handling**: OpenAI API provides clear error messages

**Usage Patterns**:
- **Provisioning Suggestions**: Generate provisioning steps based on user goals
- **Configuration Validation**: Explain why a configuration is invalid
- **Workflow Optimization**: Suggest improvements to user's provisioning workflow
- **Documentation**: Generate explanations of GHL features

**Trade-offs**:
- **Drawback**: External API dependency, costs per API call
- **Drawback**: Rate limiting and quota concerns at scale
- **Drawback**: No offline capability

**Cost Mitigation**:
- Implement AI prompt caching for common queries
- Use cheaper model variants when appropriate
- Implement request throttling per user

**Alternatives Considered**:
- **Claude API**: Good alternative, similar pricing
- **Local LLaMA/Ollama**: Privacy advantage, but infrastructure overhead, model quality concerns
- **Anthropic Claude**: Excellent capability, similar cost to GPT-4o-mini

---

### ADR-006: Server-Sent Events (SSE) for Real-time Updates

**Status**: Accepted

**Context**:
Provisioning jobs are long-running. Users need real-time feedback on job progress. Real-time communication options: WebSocket, Polling, SSE.

**Decision**:
Use Server-Sent Events (SSE) for real-time job status updates.

**Rationale**:
1. **Simplicity**: Built on HTTP, no special protocol handling
2. **One-Way Communication**: Server → Client is sufficient for job updates
3. **Browser Support**: Native browser API (`EventSource`), no client library needed
4. **Server Load**: Less overhead than WebSocket for one-way communication
5. **Scalability**: Easier to scale than WebSocket (no full duplex required)
6. **Error Handling**: Automatic reconnection built-in
7. **HTTP Middleware**: Works with standard HTTP proxies and load balancers

**Implementation**:
- API route `/api/sse/stream?jobId=xxx` opens persistent connection
- Server maintains list of active SSE connections
- When job status updates, broadcast to subscribed clients
- Client uses `EventSource` API to listen for updates

**Trade-offs**:
- **Drawback**: HTTP/1.1 connection limits (browsers limit ~6 per domain, mitigated with domain sharding or HTTP/2)
- **Drawback**: No client → server communication (acceptable, client already has polling option)
- **Drawback**: Stateful connections harder to load balance (acceptable for MVP)

**Reconnection Strategy**:
- Auto-reconnect with exponential backoff
- Fallback to polling if SSE fails
- Graceful degradation

**Alternatives Considered**:
- **WebSocket**: Full duplex overkill for one-way push, more complex infrastructure
- **Long Polling**: Less efficient than SSE, more bandwidth
- **Polling Only**: Simple but high latency, higher server load

---

## Security Considerations

### Authentication & Authorization
- NextAuth.js handles secure token exchange
- GHL OAuth token stored securely in session
- Role-based access control: users can only access their own jobs
- CSRF protection via NextAuth.js

### API Security
- All API routes require authentication check
- Input validation with Zod on server side
- SQL injection prevention: Prisma parameterized queries
- Rate limiting on OpenAI calls per user

### Data Protection
- Environment variables for secrets (API keys, database URL)
- No sensitive data logged
- HTTPS enforced on all connections
- Secure HTTP-only cookies for session tokens

### Database Security
- Vercel Postgres provides encryption at rest
- Connection pooling via Prisma
- Regular backups (Vercel automatic)
- Row-level security can be added later if needed

---

## Performance Optimizations

### Frontend
- Code splitting via Next.js automatic chunking
- Image optimization with `next/image`
- CSS-in-JS with Tailwind: minimal bundle size
- Client-side caching with React Query
- SSE reduces polling requests

### Backend
- API route optimization: minimal middleware
- Database query optimization: Prisma eager loading
- Connection pooling: Vercel Postgres managed
- Job queue batch processing: optional for scale
- AI response caching: store common generations

### Database
- Indexes on `userId`, `jobId`, `status`
- Partition large tables if needed (future)
- Connection pool sizing via Prisma

---

## Monitoring & Observability

### Current Implementation
- Vercel Analytics for frontend metrics
- Server logs: stdout captured by Vercel
- Database query logs: Prisma debug mode in development
- Manual error tracking: API responses include error details

### Future Enhancements
- Sentry/Rollbar for error tracking
- LogRocket for session replay
- Datadog/New Relic for APM
- Custom analytics: track provisioning success rates

---

## Future Considerations

### Scalability Path
1. **MVP (Current)**: Single Vercel deployment, PostgreSQL, database queue
2. **Growing**: Add caching layer (Redis), migrate queue to dedicated service
3. **Mature**: Multi-region deployment, read replicas, dedicated API servers

### Feature Additions
- Webhook support for GHL events
- Bulk provisioning jobs
- Workflow templates and saving
- Advanced analytics dashboard
- CLI tool for provisioning

### Technology Upgrades
- Redis queue when job volume exceeds 10k/day
- Dedicated API server when frontend/backend need different scaling
- GraphQL if API complexity increases significantly

---

## Deployment Checklist

- [ ] PostgreSQL database created in Vercel
- [ ] Vercel Postgres environment variables configured
- [ ] NextAuth.js secrets generated (`NEXTAUTH_SECRET`)
- [ ] GHL OAuth credentials obtained and configured
- [ ] OpenAI API key obtained and configured
- [ ] Prisma migrations run: `prisma migrate deploy`
- [ ] Environment variables set in Vercel dashboard
- [ ] Git repository connected to Vercel
- [ ] Automatic deployments enabled
- [ ] Health check endpoint tested
- [ ] SSE connectivity tested in production

---

## References

- [Next.js 14 Documentation](https://nextjs.org/docs)
- [NextAuth.js v5 Documentation](https://authjs.dev)
- [Prisma Documentation](https://www.prisma.io/docs)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Vercel Documentation](https://vercel.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Component Library](https://ui.shadcn.com)
