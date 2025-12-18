# 09 — TESTING & QA (Template)

## Test Types
- Backend unit: {{UNIT_TEST_FRAMEWORK}}
- Frontend unit: {{FE_TEST_FRAMEWORK}}
- Integration/E2E: {{INTEGRATION_TOOL}} (recommended: Playwright)
- Lint/format: {{LINT_TOOLS}}

## Tool Allowlist (safe commands)
- npm/pnpm/yarn: test, lint, build
- pytest/ruff/mypy
- go test ./...

## QA Gates
- Unit tests pass
- Lint passes
- Build passes
- E2E smoke passes

## Coach Rule
Coach blocks completion until evidence shows green.
