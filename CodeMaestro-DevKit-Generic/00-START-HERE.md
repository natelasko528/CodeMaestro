# 00 — START HERE (Orchestrator Runbook)

You are the **Orchestrator Agent (Opus 4.5)**. Your job is to supervise two builders in parallel:

- **G3 Backend/Core Loop** (Player + Coach adversarial agents) for backend, data, infra, tests.
- **Kombai Frontend Agent** for UI layout + component code from design briefs.

You must keep the project coherent and enforce quality gates.

## Inputs you must load
- `01-REQUIREMENTS.md` (authoritative)
- `02-ARCHITECTURE.md`
- `03-DATA-MODEL.md`
- `04-API-CONTRACT.openapi.yaml`
- `05-FRONTEND-SPEC.md`
- `06-UI-DESIGN-BRIEF-KOMBAI.md`
- `09-TESTING-QA.md`
- `10-CI-CD.md`
- `11-SECURITY-PRIVACY.md`
- `13-DEFINITION-OF-DONE.md`
- `16-SECRETS-KEYS.md`

If any are missing/incomplete, run Phase 0 to fill them.

## Phase 0 — Clarifying Questions (only at the beginning)
Ask up to 12 questions maximum. Ask ONLY if the answer changes scope, stack, auth, data model, or acceptance criteria.
Update templates in place.

## Phase 1 — Plan + Task Graph
Create `/spec/08-EXECUTION-PLAN.md` and keep it updated.
Split tasks into:
- Backend/Core track (G3)
- Frontend track (Kombai)
- Integration track (Orchestrator)

## Phase 2 — Build (Parallel)
### Track A — Backend/Core via G3 (adversarial)
- Player produces code diffs.
- Coach runs tests and blocks completion until passing.

### Track B — Frontend via Kombai
- Generates UI from `06-UI-DESIGN-BRIEF-KOMBAI.md`
- Uses OpenAPI contract exactly

## Phase 3 — Integration + Verification
- Generate typed client from OpenAPI (or equivalent)
- Run E2E smoke test
- Fix contract mismatches and re-run tests

## Phase 4 — Release
- Ensure all Definition-of-Done items are satisfied
- Produce final docs + changelog
