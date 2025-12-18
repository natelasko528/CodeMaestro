# 07 — AGENT CONFIG (Model-Agnostic Template)

## Roles (placeholders)
- Orchestrator: {{ORCHESTRATOR_MODEL}}
- Backend Player: {{PLAYER_MODEL}}
- Backend Coach: {{COACH_MODEL}}
- Frontend UI: {{UI_MODEL}}
- Integration Verifier: {{VERIFIER_MODEL}}

## Policies
- No completion without tests passing
- Contract-first (OpenAPI authoritative)
- Fresh context each iteration (summaries)
- Max iterations: {{MAX_ITERS}} (default 10)
