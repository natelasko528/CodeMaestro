# 08 — EXECUTION PLAN

## Overview
This execution plan splits work across three parallel tracks following the CodeMaestro methodology:
- **Backend/Core Track**: Player + Coach adversarial loop (G3)
- **Frontend Track**: Kombai UI agent
- **Integration Track**: Orchestrator

## Task Graph

| Task ID | Description | Owner Agent | Depends On | Done When | Est. Time |
|---------|-------------|-------------|------------|-----------|-----------|
| **BACKEND/CORE TRACK (Player + Coach)** |
| T-001 | Initialize Next.js 14 project with TypeScript | Player | - | `npm run dev` starts | 15min |
| T-002 | Set up Prisma + PostgreSQL schema | Player | T-001 | Migrations run, models generated | 30min |
| T-003 | Implement database models (Agency, Job, Snapshot, Log, User) | Player | T-002 | Schema matches 03-DATA-MODEL.md | 45min |
| T-004 | Create OAuth token encryption utilities (AES-256-GCM) | Player | T-003 | Unit tests pass | 30min |
| T-005 | Implement NextAuth.js OAuth provider for GHL | Player | T-004 | Auth flow completes locally | 60min |
| T-006 | Build GHL API client wrapper (locations, users, snapshots) | Player | T-003 | Unit tests with MSW pass | 45min |
| T-007 | Create database-based job queue system | Player | T-003 | Queue processes jobs in FIFO order | 60min |
| T-008 | Implement POST /api/provision endpoint | Player | T-006, T-007 | API test passes | 45min |
| T-009 | Build AI snapshot selection service (OpenAI integration) | Player | T-006 | Recommends correct snapshot | 60min |
| T-010 | Implement custom value injection logic | Player | T-006 | Custom values applied correctly | 45min |
| T-011 | Create user provisioning service (GHL users API) | Player | T-006 | Users created with correct roles | 30min |
| T-012 | Build SSE endpoint for real-time job updates | Player | T-007 | Client receives live updates | 45min |
| T-013 | Implement rate limiting middleware | Player | T-001 | Rate limits enforced correctly | 30min |
| T-014 | Create audit logging system | Player | T-003 | All operations logged | 30min |
| T-015 | Write unit tests for all services | Coach | T-004-T-014 | 80%+ coverage, all pass | 90min |
| T-016 | Write integration tests with MSW | Coach | T-015 | All API flows tested | 60min |
| **FRONTEND TRACK (Kombai)** |
| T-101 | Set up Tailwind CSS + shadcn/ui | Kombai | T-001 | Styles render correctly | 30min |
| T-102 | Create layout components (Header, Sidebar, Footer) | Kombai | T-101 | Layout renders | 45min |
| T-103 | Build /dashboard page with stats cards | Kombai | T-102 | Page renders with mock data | 60min |
| T-104 | Build /connect OAuth flow page | Kombai | T-102 | OAuth button functional | 45min |
| T-105 | Create ProvisioningForm component | Kombai | T-102 | Form validates and submits | 90min |
| T-106 | Build /provision page with form | Kombai | T-105 | Page functional | 30min |
| T-107 | Create JobStatusCard component | Kombai | T-102 | Status badges render | 45min |
| T-108 | Build /jobs list page with table | Kombai | T-107 | Table renders with pagination | 60min |
| T-109 | Create LiveLogViewer component (SSE) | Kombai | T-102 | Connects to SSE endpoint | 60min |
| T-110 | Build /jobs/[id] detail page | Kombai | T-109 | Live logs stream correctly | 45min |
| T-111 | Create SnapshotSelector component | Kombai | T-102 | Grid displays snapshots | 60min |
| T-112 | Build /snapshots library page | Kombai | T-111 | Search and filter work | 45min |
| T-113 | Create OAuthStatus component | Kombai | T-102 | Connection status displays | 30min |
| T-114 | Build /settings page | Kombai | T-113 | Settings form functional | 60min |
| **INTEGRATION TRACK (Orchestrator)** |
| T-201 | Generate TypeScript API client from OpenAPI | Orchestrator | T-008, T-101 | Types match API contract | 30min |
| T-202 | Connect frontend to backend APIs | Orchestrator | T-201, T-114 | Data flows correctly | 60min |
| T-203 | Implement error handling and toasts | Orchestrator | T-202 | Errors display properly | 30min |
| T-204 | Set up environment variables (.env.example) | Orchestrator | T-005 | All secrets documented | 15min |
| T-205 | Write E2E tests (Playwright) | Orchestrator | T-202 | Critical flows pass | 90min |
| T-206 | Configure GitHub Actions CI/CD | Orchestrator | T-205 | Pipeline runs green | 45min |
| T-207 | Create README.md with setup instructions | Orchestrator | T-204 | Setup works from scratch | 30min |
| T-208 | Run full E2E smoke test | Orchestrator | T-206 | All Definition-of-Done items ✓ | 30min |

## Critical Path
```
T-001 → T-002 → T-003 → T-006 → T-008 → T-201 → T-202 → T-205 → T-208
```

## Parallel Execution Strategy

### Phase 2A: Backend Foundation (Player)
Run T-001 through T-007 sequentially with Coach reviewing after each milestone.

### Phase 2B: Backend Services (Player + Coach adversarial)
- Player implements T-008 → T-014
- Coach reviews, runs tests, blocks until passing
- Adversarial loop ensures quality

### Phase 2C: Frontend (Kombai)
Run T-101 → T-114 in parallel with backend track.

### Phase 3: Integration (Orchestrator)
After both tracks complete, run T-201 → T-208.

## Success Criteria
- [ ] All tasks marked "Done When" criteria met
- [ ] Backend tests pass (T-015, T-016)
- [ ] Frontend builds without errors (T-101-T-114)
- [ ] E2E tests pass (T-205)
- [ ] CI/CD pipeline green (T-206)
- [ ] Definition of Done checklist complete (T-208)

## Risk Mitigation
- **Risk**: OAuth flow fails in dev → **Mitigation**: Mock OAuth in tests, test with real GHL account
- **Risk**: Rate limiting blocks tests → **Mitigation**: Use MSW to mock GHL API
- **Risk**: Database migrations fail → **Mitigation**: Test migrations in Docker container first
- **Risk**: SSE connections unstable → **Mitigation**: Implement reconnection logic with exponential backoff
