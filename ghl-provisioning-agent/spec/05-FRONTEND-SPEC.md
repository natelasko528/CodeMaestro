# 05 — FRONTEND SPECIFICATION

## Stack

- **Framework**: Next.js 14 (App Router)
- **UI Components**: shadcn/ui (Radix UI primitives + Tailwind CSS)
- **Styling**: Tailwind CSS 3.x
- **State Management**: React Server Components + Minimal Client State
- **Runtime**: Node.js 18+

---

## Pages & Routes

### `/dashboard`
**Purpose**: Overview statistics and agency health dashboard

**Content**:
- Key metrics cards (sub-accounts count, active jobs, snapshot usage)
- Recent activity feed
- Quick action buttons (New Provision, View Jobs)
- Agency name/settings indicator

**Data Fetching**: Server-side (RSC with `async` components)

---

### `/connect`
**Purpose**: GHL OAuth authentication flow initiation

**Content**:
- OAuth connection button (GHL branding)
- Current connection status indicator
- Authorization scope explanation
- Redirect callback handling

**Flow**:
1. User clicks "Connect GHL Account"
2. Redirects to GHL OAuth endpoint with client credentials
3. GHL redirects back to callback URL (configured in backend)
4. Token stored in secure HTTP-only cookie
5. Redirect to `/dashboard`

**Data Fetching**: Client-side for OAuth state management (useEffect hook)

---

### `/provision`
**Purpose**: Create new sub-account provisioning form

**Content**:
- ProvisioningForm component (see Components section)
- AI snapshot suggestions sidebar
- Form validation feedback
- Submission status

**Fields**:
- Sub-account name (required, string)
- Email (required, valid email format)
- Phone (optional, string)
- Industry/vertical (optional, select dropdown)
- AI suggestion toggles (optional, checkboxes)

**Data Fetching**:
- Server-side: Load agency settings, available snapshots
- Client-side: Form submission via POST /api/provision

---

### `/jobs`
**Purpose**: Paginated list of all provisioning jobs with status tracking

**Content**:
- JobStatusCard components in grid/table layout
- Filters (Status: pending/running/completed/failed; Date range)
- Pagination controls (20 items per page)
- Search by sub-account name

**Data Fetching**: Server-side (RSC with pagination query params)

---

### `/jobs/[id]`
**Purpose**: Detailed job view with live log streaming

**Content**:
- Job metadata (created at, estimated duration, sub-account details)
- LiveLogViewer component (SSE-connected)
- Current step indicator
- Estimated/actual runtime
- Action buttons (Retry, Cancel, Export logs)

**Data Fetching**:
- Server-side: Initial job data
- Client-side: SSE connection to `/api/jobs/[id]/logs?stream=true`

**Update Strategy**: WebSocket/Server-Sent Events (SSE) for real-time log streaming

---

### `/snapshots`
**Purpose**: Library of available snapshots with search and preview

**Content**:
- SnapshotSelector component (searchable grid)
- Snapshot metadata cards (name, description, version, created date)
- Preview panel (right sidebar or modal)
- "Use in Provision" quick action
- Filter by category/tag

**Data Fetching**: Server-side (RSC with search query support)

---

### `/settings`
**Purpose**: Agency account settings and configuration

**Content**:
- Agency name/branding
- API key management (view/rotate)
- Webhook configuration
- OAuth token status
- Integration logs
- Danger zone: Reset account, disconnect GHL

**Data Fetching**: Server-side (RSC) with form mutations for updates

---

## Components

### ProvisioningForm
**Location**: `app/(dashboard)/provision/components/ProvisioningForm.tsx`

**Type**: Client Component (`'use client'`)

**Props**:
```typescript
{
  defaultValues?: Partial<ProvisionForm>,
  onSuccess?: (jobId: string) => void,
  suggestedSnapshots?: Snapshot[]
}
```

**Features**:
- Multi-step form (Basic Info → Snapshots → Confirmation)
- Client-side form validation (Zod or React Hook Form)
- AI snapshot suggestions sidebar (powered by backend insights)
- Real-time field validation feedback
- Loading state during submission
- Error toast notifications

**API Calls**:
- `POST /api/provision` — Submit new sub-account

---

### JobStatusCard
**Location**: `app/(dashboard)/components/JobStatusCard.tsx`

**Type**: Server Component (default RSC)

**Props**:
```typescript
{
  job: Job,
  isLink?: boolean
}
```

**Features**:
- Status badge (Pending, Running, Completed, Failed) with color coding
- Progress bar (if running)
- Sub-account name
- Created timestamp (relative time)
- Action menu (View Details, Retry, Cancel)
- Visual indicator for job type (Provision, Update, Delete)

**Styling**:
- Tailwind badge variants
- shadcn/ui Badge, Card, Skeleton components

---

### SnapshotSelector
**Location**: `app/(dashboard)/provision/components/SnapshotSelector.tsx`

**Type**: Client Component (`'use client'`)

**Props**:
```typescript
{
  selectedSnapshots?: string[],
  onSelectionChange?: (ids: string[]) => void,
  suggestedIds?: string[],
  searchPlaceholder?: string
}
```

**Features**:
- Searchable grid layout (3-column responsive)
- Checkbox selection
- "Suggested" badges on recommended snapshots
- Preview on hover/click (modal or sidebar)
- Tags/categories display
- Version indicator
- Quick preview button

**Search Strategy**: Client-side filtering (debounced input) + server-side pagination fallback

---

### LiveLogViewer
**Location**: `app/(dashboard)/jobs/[id]/components/LiveLogViewer.tsx`

**Type**: Client Component (`'use client'`)

**Props**:
```typescript
{
  jobId: string,
  autoScroll?: boolean,
  maxLines?: number
}
```

**Features**:
- SSE connection to `/api/jobs/[id]/logs?stream=true`
- Real-time log line rendering
- Syntax highlighting for structured logs
- Auto-scroll to bottom (disable with checkbox)
- Copy logs button
- Download logs as .txt
- Log level filtering (Info, Warn, Error)
- Timestamp display for each line
- Graceful error handling (connection lost → retry button)

**SSE Event Format**:
```json
{
  "type": "log_line",
  "timestamp": "2025-12-18T10:34:00Z",
  "level": "info|warn|error|debug",
  "message": "Provisioning started...",
  "step": "validation",
  "progress": 25
}
```

---

### OAuthStatus
**Location**: `app/components/OAuthStatus.tsx`

**Type**: Server Component (default RSC)

**Props**:
```typescript
{
  minimal?: boolean
}
```

**Features**:
- Connected indicator (green dot + "Connected")
- Disconnected state with "Connect" button
- Account email display (if connected)
- Last synchronized timestamp
- Quick disconnect action (with confirmation)
- Error state if token expired/revoked

---

## State Management Strategy

### React Server Components (RSC)
- Default for data fetching and static content
- Used for: dashboards, lists, detail pages (initial render)
- Reduce JS bundle size; leverage Node.js for data access

### Client State
Minimal use of client-side state via hooks:
- Form state (useForm, useState)
- UI state (modals, dropdowns, filters)
- Real-time connections (SSE in LiveLogViewer)
- User interactions (toast notifications)

### Data Fetching Pattern
```typescript
// Server Component (app/dashboard/page.tsx)
export default async function DashboardPage() {
  const stats = await fetchDashboardStats();
  return <Dashboard stats={stats} />;
}

// Client Component with client-side data
'use client'
export function LiveLogViewer({ jobId }) {
  useEffect(() => {
    const sse = new EventSource(`/api/jobs/${jobId}/logs?stream=true`);
    // Handle SSE events
  }, [jobId]);
}
```

### Store/Context (Minimal)
- **OAuthContext**: Current user, GHL connection status (optional, fallback to server state)
- **ToastContext**: Global notification system (shadcn/ui Toast)
- Avoid Redux/Zustand for this application scope

---

## Styling & Design System

### Tailwind CSS Configuration
- Custom color palette matching GHL brand (primary, secondary, accent)
- Responsive breakpoints: `sm`, `md`, `lg`, `xl`, `2xl`
- Custom spacing scale (4px base unit)
- Dark mode support (class-based, optional)

### shadcn/ui Component Usage
- Button, Card, Input, Select, Badge
- Dialog, Sheet (modals)
- Toast system for notifications
- Tabs for multi-section pages
- Table for job lists
- Skeleton for loading states

### CSS Guidelines
- Use Tailwind utility classes (no custom CSS except design tokens)
- No inline styles
- Mobile-first responsive design
- Consistent spacing: 4px, 8px, 12px, 16px, 24px, 32px
- Focus states on all interactive elements (a11y)

### Theme/Branding
- **Primary Color**: GHL brand blue (e.g., #007AFF or per brand guide)
- **Secondary Color**: Neutral gray (#64748B)
- **Success**: Green (#10B981)
- **Warning**: Amber (#F59E0B)
- **Error**: Red (#EF4444)
- **Typography**: System font stack (Inter, -apple-system, BlinkMacSystemFont, sans-serif)

---

## API Integration Rules

### Generated TypeScript Client
- Generate from OpenAPI spec (`04-API-CONTRACT.openapi.yaml`)
- Output: `/lib/generated/api-client.ts` (e.g., using openapi-generator or @openapi-ts/cli)
- All API calls must be typed (no `any` types)
- Use generated enums for status values

### Configuration
```typescript
// lib/api-client.ts
export const apiClient = new ApiClient({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 30000,
  headers: {
    'X-Agency-ID': agencyId, // From auth context or server cookies
  }
});
```

### No Hard-Coded URLs
- All API endpoints via `process.env.NEXT_PUBLIC_*` or server-side env vars
- Use typed client methods instead of fetch directly

### Error Handling
- Wrap API calls in try-catch
- Display user-friendly error messages (avoid exposing stack traces)
- Log errors to observability platform (e.g., Sentry)

### Authentication
- GHL OAuth token stored in HTTP-only cookie (`ghl_token`)
- Backend validates token on each request
- Frontend checks token expiry; redirect to `/connect` if expired

---

## Directory Structure

```
app/
├── (dashboard)/                        # Protected layout group
│   ├── layout.tsx                      # Shared dashboard layout (nav, sidebar)
│   ├── page.tsx                        # /dashboard
│   ├── provision/
│   │   ├── page.tsx                    # /provision
│   │   └── components/
│   │       ├── ProvisioningForm.tsx
│   │       └── SnapshotSelector.tsx
│   ├── jobs/
│   │   ├── page.tsx                    # /jobs
│   │   ├── [id]/
│   │   │   ├── page.tsx                # /jobs/[id]
│   │   │   └── components/
│   │   │       └── LiveLogViewer.tsx
│   │   └── components/
│   │       └── JobStatusCard.tsx
│   ├── snapshots/
│   │   └── page.tsx                    # /snapshots
│   └── settings/
│       └── page.tsx                    # /settings
├── connect/
│   ├── page.tsx                        # /connect
│   └── callback/
│       └── route.ts                    # OAuth callback handler
├── api/
│   ├── provision/
│   │   └── route.ts                    # POST /api/provision
│   ├── jobs/
│   │   ├── route.ts                    # GET /api/jobs
│   │   └── [id]/
│   │       └── logs/
│   │           └── route.ts            # GET /api/jobs/[id]/logs (SSE)
│   └── auth/
│       └── route.ts                    # GET /api/auth/status
├── components/
│   ├── OAuthStatus.tsx
│   ├── Navigation.tsx                  # Top navbar
│   └── Sidebar.tsx                     # Left sidebar (optional)
├── layout.tsx                          # Root layout (auth wrapper)
└── page.tsx                            # / (redirect to /dashboard or /connect)

lib/
├── api-client.ts                       # Generated or configured
├── hooks/
│   ├── useOAuth.ts
│   ├── useProvision.ts
│   └── useJobs.ts
├── types/
│   └── index.ts                        # Re-export from generated client
└── utils/
    ├── format.ts                       # Date, status formatting
    └── validation.ts                   # Form validators

public/
├── favicon.ico
└── ghl-logo.png
```

---

## Performance Considerations

### Bundle Size
- Use Next.js code splitting (automatic with App Router)
- Lazy-load heavy components (e.g., log viewers)
- Import `shadcn/ui` components individually (tree-shaking)

### Image Optimization
- Use `next/image` for all images
- Set `priority` on above-the-fold images
- Responsive image sizes with `sizes` prop

### Caching Strategy
- **Server Data**: Cache with `revalidateTag()` or time-based revalidation
- **Client State**: Minimize; rely on server-side caching
- **Static Assets**: Cache headers via `next.config.js`

### SSE Connection Management
- Graceful reconnection with exponential backoff
- Cleanup event listeners on component unmount
- Max 5 concurrent SSE connections per browser

---

## Accessibility (a11y)

- All interactive elements keyboard-accessible (Tab, Enter, Escape)
- ARIA labels on icons and status badges
- Color contrast ratio ≥ 4.5:1 (WCAG AA)
- Form labels associated with inputs
- Focus management in modals and dialogs
- Live region announcements for real-time updates (LiveLogViewer)

---

## Testing Strategy

### Unit Tests
- Component prop validation
- Form validation logic
- Helper function utilities

### Integration Tests
- API client integration
- Form submission flow
- OAuth callback handling

### E2E Tests
- Full user journey (connect → provision → monitor job)
- SSE connection and log streaming
- Error states and recovery

---

## Deployment & Environment

### Environment Variables
```
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
NEXT_PUBLIC_GHL_CLIENT_ID=<GHL OAuth Client ID>
NEXT_PUBLIC_GHL_REDIRECT_URI=https://app.example.com/connect/callback
```

### Build Output
- Next.js static export (if no SSR needed) OR
- Vercel deployment (recommended for managed hosting)
- Docker container for self-hosted deployment

---

## Design Tokens

### Colors
| Token | Value | Usage |
|-------|-------|-------|
| primary | #007AFF (or per brand) | Buttons, active states, primary CTAs |
| secondary | #64748B | Secondary buttons, muted text |
| success | #10B981 | Success badges, checkmarks |
| warning | #F59E0B | Warning alerts, pending states |
| error | #EF4444 | Error states, failure badges |
| background | #FFFFFF / #0F172A (dark) | Page backgrounds |
| foreground | #1E293B / #F8FAFC (dark) | Text, borders |

### Typography
| Token | Font | Size | Weight | Line Height |
|-------|------|------|--------|-------------|
| h1 | Inter | 32px | 700 | 1.2 |
| h2 | Inter | 24px | 700 | 1.3 |
| h3 | Inter | 20px | 600 | 1.4 |
| body | Inter | 16px | 400 | 1.5 |
| small | Inter | 14px | 400 | 1.5 |
| caption | Inter | 12px | 500 | 1.4 |

### Spacing Scale
`4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`, `64px`

### Border Radius
- Small: `4px`
- Medium: `6px`
- Large: `8px`
- Full: `9999px`

---

## Version History
- **v1.0.0** (2025-12-18): Initial frontend specification for GHL Provisioning Agent
