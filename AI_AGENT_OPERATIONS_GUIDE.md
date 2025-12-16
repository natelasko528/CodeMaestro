# CodeMaestro Autonomous Agent Operations Guide (Model-Agnostic)

This guide unifies every rule, workflow, and artifact contract an AI coding agent must follow to build applications with CodeMaestro. It is intentionally model-agnostic and emphasizes repeatable, object-oriented processes and state transitions any capable agent can implement. The guidance below expands each stage of software development—from intake to operations—so an autonomous agent can build new apps end to end without missing steps.

## 1. Repository Map and Entry Points
- **Root structure:** See `README.md` for the three pillars: DevKit, VS Code Wrapper ProjectKit, and MVP engine specs. Always start with the numbered templates in each kit, beginning at `00-START-HERE.md` within the relevant folder.
- **Key directories:**
  - `CodeMaestro-DevKit-Generic/` — templates and prompts for generic applications.
  - `ProjectKit-CodeMaestro-VSCode-Wrapper/` — specifications for the VS Code extension wrapper.
  - `server/mvp/` and `spec/` — engine scope locks, golden tasks, replay rules, and allowlist definitions.
  - `extension/` — VS Code extension shell (chat webview, apply edits, tool output display, SecretStorage wiring).
  - `server/` — orchestrator engine implementation (state machine, protocol handling, allowlisted tool runner, session store, replay).

## 2. Required Inputs Before Coding (Phase 0: Intake & Discovery)
Load and complete these templates (create if missing) before planning or coding; missing data must be resolved via clarifying questions (≤12, only if they change scope/stack/auth/data/acceptance):
- **Requirements & Context:** `01-REQUIREMENTS.md`, `00-START-HERE.md` (per kit).
- **Architecture & Data:** `02-ARCHITECTURE.md`, `03-DATA-MODEL.md`, `04-API-CONTRACT.openapi.yaml`.
- **UI/UX:** `05-FRONTEND-SPEC.md`, `06-UI-DESIGN-BRIEF-KOMBAI.md`.
- **Quality & Delivery:** `09-TESTING-QA.md`, `10-CI-CD.md`, `13-DEFINITION-OF-DONE.md`.
- **Security & Ops:** `11-SECURITY-PRIVACY.md`, `16-SECRETS-KEYS.md`.
- **Non-functional needs to capture:** performance, availability, observability, compliance, data retention, migration/seed data, rollout/rollback strategy, feature flags, and localization if relevant.

## 3. Orchestrator Phases (Role-Based, Model-Agnostic)
Follow a role-driven loop that any compatible agents can fill. Each phase should produce explicit artifacts and checkpoints:
1. **Phase 1 — Plan**
   - Maintain `/spec/08-EXECUTION-PLAN.md` with tasks split into Backend/Core builder, Frontend/UI builder, and Integration roles.
   - Capture assumptions, risks, dependencies, sequencing, and acceptance criteria per task.
   - Identify testing strategy (unit, integration, e2e, contract, accessibility, performance) and required fixtures.
2. **Phase 2 — Build**
   - **Backend/Core track:** Implementation agent emits diffs; validation agent runs tests and blocks until green. Cover data modeling, API handlers, business rules, error handling, logging, and feature-flag toggles.
   - **Frontend/UI track:** Generate UI from the design brief and OpenAPI contract; maintain type alignment with API client; include loading/empty/error states and basic accessibility (labels, ARIA for form controls).
   - **Infrastructure stubs:** Add config defaults, environment variable schema, and secrets access points (but no raw keys in repo).
3. **Phase 3 — Integration**
   - Generate or handcraft a typed client from the OpenAPI contract; validate request/response shapes and error envelopes.
   - Run end-to-end smoke tests; verify auth flows, state persistence, file I/O, and idempotent tool runs.
   - Resolve contract mismatches and update the OpenAPI file and client together.
4. **Phase 4 — Release & Ops Readiness**
   - Ensure Definition of Done is satisfied; publish documentation/changelog artifacts.
   - Provide rollout steps, rollback switches, and post-release verification checks; ensure migrations (if any) are reversible.
   - Record operational runbooks for starting/stopping services, log locations, and health checks.

## 4. Orchestrator State Machine (Server Engine)
Operate the server through deterministic states: `IDLE`, `PLANNING`, `BUILDING (IMPLEMENTER)`, `VERIFYING (VALIDATOR)`, `WAITING_FOR_APPLY`, `RUNNING_TOOL`, `DONE`, `FAILED`.
- **Transitions:**
  - USER_PROMPT → planner output → `AGENT_MESSAGE(phase=planner)` (PLANNING).
  - Planner accepted → `AGENT_MESSAGE(phase=implementer)` + `PROPOSE_EDIT` (BUILDING) → `STATUS(WAITING_FOR_APPLY)`.
  - On `APPLY_EDIT_RESULT(applied=true)` → `AGENT_MESSAGE(phase=validator)` (VERIFYING).
  - Validator may trigger `RUN_TOOL` and consume `TOOL_OUTPUT`; on failure loop back to BUILDING, on success advance to DONE.
- **Rolling summary:** After each state, update `summary.md` with current task, files changed, last test command/result, risk/issue log, and next actions.
- **Failure handling:** On test failure or contract mismatch, capture root cause, add a remediation task to the plan, and require a rerun of the failing command before advancing.

## 5. MVP Scope Lock (What to Build vs Skip)
- **Include:** Local engine (JSONL protocol, orchestrator state machine, allowlist tool runner, session store/export, replay mode, provider abstraction with mocks), VS Code extension shell (chat, start/send, agent-tagged messages, diff preview and apply/reject for multi-file edits, SecretStorage plumbing), and tests covering server protocol/allowlist/session/replay plus extension edit application.
- **Exclude:** Advanced UI, multi-agent parallelism, embeddings, cloud deployment, full OpenAPI client generation, and marketing polish.
- **Timebox:** Prefer the smallest safe workaround; mocks/stubs are allowed; the UI can remain basic but diff/apply must work.
- **Keep future-proofing hooks:** Interfaces should allow swapping providers, adding tracing, and expanding command allowlists without breaking MVP paths.

## 6. Golden Tasks (Proof of Readiness)
Run each Golden Task in a fresh session and store artifacts under `.codemaestro/sessions/<sessionId>/`:
- **GT-001:** Session boot and planner output with a numbered plan; ensure `summary.md` and `events.jsonl` exist.
- **GT-002:** Multi-file `PROPOSE_EDIT` with diff preview and apply; expect `applied=true` and per-file success.
- **GT-003:** Allowlisted tool run (e.g., `npm test`); capture stdout, stderr, and exitCode; the validator must react to failures.
- **GT-004:** Validation gating: failing test must block completion until the fix plus rerun passes.
- **GT-005:** Secrets safety: key stored via VS Code command must never appear in logs or exports; redact on write.
- **GT-006:** Replay: offline replay (no network) must reproduce event-type sequence and emit `replay_report.md`.
MVP is incomplete until GT-001..GT-006 all pass.

## 7. Protocol and Patch Contracts
- **Transport:** JSONL messages between server and extension.
- **Message types:** USER/AGENT messages, STATUS, PROPOSE_EDIT, APPLY_EDIT_RESULT, RUN_TOOL, TOOL_OUTPUT, REPLAY_REPORT.
- **PROPOSE_EDIT payload:** includes an `edits` array with `filePath`, full `newText` (≤2MB, UTF-8), `summary`, and optional rationale/test plan. Paths must stay within the workspace (no `..`).
- **APPLY_EDIT_RESULT:** returns an `applied` boolean and per-file results with error messages when rejected.
- **Diff/UI:** The server sends full file contents; the extension computes diffs for preview.
- **Error discipline:** Provide actionable error codes/messages; never leak secrets; include retry guidance when safe.

## 8. Session Store and Replay
Store every session under `.codemaestro/sessions/<sessionId>/` with:
- `meta.json`, `events.jsonl` (redacted), `summary.md` (rolling state), `tool/` executions (`T-0001.json/stdout/stderr`), and `edits/E-XXXX` folders containing `manifest.json` plus `before/` and `after/` snapshots.
- **Redaction:** Never write raw API keys; redact any field containing `key`, `token`, or `secret` before persisting.
- **Replay:** Offline mode replays events without network calls and must keep event-type sequences and file hashes consistent; produce `replay_report.md`.
- **Traceability:** Link edits to originating prompts/tasks; include test commands and results per edit; preserve timestamps for auditing.

## 9. Tool Runner Allowlist
Execute only the exact commands below (no pipes/redirects/`&&`; working directory inside the workspace):
- **Node:** `npm test`, `npm run test`, `npm run lint`, `npm run build`
- **pnpm/yarn (if used):** `pnpm test`, `pnpm run lint`, `pnpm run build`, `yarn test`, `yarn lint`, `yarn build`
- **Python (if applicable):** `pytest`, `python -m pytest`, `ruff check .`, `mypy .`
Capture stdout, stderr, and exitCode; truncate UI streams at ~200KB but keep full logs in session artifacts. A validator agent must read outputs and update `summary.md` with pass/fail context.

## 10. VS Code Extension Shell Expectations
- Provide a chat webview (basic) showing agent-tagged messages.
- Commands: start session, send prompt, show diff preview for multi-file `PROPOSE_EDIT`, apply/reject edits, and surface tool output.
- SecretStorage commands: set/clear key per provider; never log keys and do not persist server-side. The server must never store secrets.
- Integration smoke: launch "Run CodeMaestro Extension (MVP)", run `CodeMaestro: Start Session` and `CodeMaestro: Open Chat`, then verify multi-file proposal, diffs, Apply, and tool output behavior.
- UX expectations: show pending/applying states, surface per-file apply errors, and include a minimal activity log for tool runs and validations.

## 11. Server Engine Goals and Run Commands
- Implement protocol handling, the orchestrator state machine, allowlist-enforced tool runner with output capture, session store/export, and replay mode. Provider abstraction may use mocks for MVP; real adapters come later.
- **Local run/test:**
  - Server: `cd server && npm install && npm run build && npm test && npm run gt` (produces `MVP_REPORT.md` and session artifacts).
  - Extension: `cd extension && npm install && npm run build && npm test`.
- **Operational hooks:** define health endpoints or CLI checks, structured logging with correlation IDs, and environment validation (required variables, default configs, and safe fallbacks for missing secrets).

## 12. Definition of Done, QA, and CI Hooks
- Honor `13-DEFINITION-OF-DONE.md` criteria from the DevKit when closing tasks.
- Follow `09-TESTING-QA.md` and `10-CI-CD.md` to align with required tests and pipelines.
- The validator role must block completion until all required tests/builds pass and evidence is recorded in session summaries.
- Add CI smoke commands mirroring the allowlist; ensure linters/formatters are enforced where specified in templates.
- Include accessibility and performance checks when required; document any deviations and waivers in `summary.md` and the final report.

## 13. Secrets, Security, and Observability
- Handle secrets only through the extension’s SecretStorage; never persist on the server.
- Redact sensitive fields in all logs, session artifacts, and exports.
- Observe logging constraints from replay rules: log every event/tool output with redaction. Avoid network calls during replay mode.
- Add basic security controls: input validation for tool commands, path normalization for edits, and denial of workspace escape. Flag PII fields in data models when applicable.
- Observability basics: structured logs, minimal metrics (tool durations, apply success rate), and traces where supported; keep all optional to preserve MVP simplicity.

## 14. Artifact Reporting
- Produce `MVP_REPORT.md` summarizing Golden Task runs with evidence (commands and outputs) and pointing to session artifact paths. Use `MVP_REPORT_TEMPLATE.md` as a scaffold.
- Keep `summary.md` updated per state to feed fresh context back into the agents.
- Maintain a concise CHANGELOG entry for user-visible behavior changes and a short README snippet for setup/run if defaults change.

## 15. Workflow Quickstart for New Apps
1. Fill the numbered templates in `CodeMaestro-DevKit-Generic/` (or wrapper kit) starting at `00-START-HERE.md`.
2. Ask clarifications if they change scope (max 12), then lock inputs.
3. Draft/update `spec/08-EXECUTION-PLAN.md` with the task graph and role ownership; note risks, dependencies, and test coverage per task.
4. Run the orchestrator loop: planner → implementer → apply → validator → tools → pass/fail until the Definition of Done is satisfied.
5. Enforce the tool allowlist and log/redact all events; store snapshots in the session store.
6. Execute Golden Tasks and capture artifacts; ensure replay determinism.
7. Deliver final code plus `MVP_REPORT.md`, updated changelog/runbooks, environment variable guidance, and confirm secrets were never logged.
8. Provide operational notes: how to start/stop services locally, expected ports, sample .env placeholders, and minimal health checks.
