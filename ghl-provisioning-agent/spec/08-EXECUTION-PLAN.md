# 08 — EXECUTION PLAN (Template)

| Task ID | Description | Owner Agent | Depends On | Done When |
|---|---|---|---|---|
| T-001 | Scaffold repo | Player | - | builds locally |
| T-002 | Data model + migrations | Player | T-001 | migrations run |
| T-003 | API endpoints + tests | Player | T-002 | tests pass |
| T-004 | UI pages/components | Kombai | T-001 | FE builds |
| T-005 | Integrate FE ↔ BE | Orchestrator | T-003,T-004 | smoke passes |
