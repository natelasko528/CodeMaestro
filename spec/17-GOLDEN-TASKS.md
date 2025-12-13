# 17 — GOLDEN TASKS (MVP Validation Suite)

These tasks are the non-negotiable proof that CodeMaestro’s engine works.
They must be **repeatable**, **loggable**, **replayable**, and **pass without manual code edits** beyond Apply/Reject.

## Rules

* Each Golden Task must run in a fresh session.
* The Coach MUST run tool allowlist commands and block completion until green.
* All artifacts go under `.codemaestro/sessions/<sessionId>/`.
* No secrets may appear in logs.

## Golden Tasks (GT-###)

### GT-001 — Session Boot + Planner Output
**Goal:** Start a session and get a planner output that produces a task list.
**Inputs:** “Implement MVP wiring for protocol + diff proposal flow.”
**Pass if:**

* AGENT_MESSAGE appears with `phase=planner` and a numbered plan
* Session store folder is created with `summary.md` and `events.jsonl`

---

### GT-002 — Multi-File PROPOSE_EDIT + Diff Preview + Apply
**Goal:** Server proposes edits to 2 files; extension previews diff; apply writes to workspace.
**Target edits (example):**

* Create `server/src/protocol.js` with JSONL parser + validator
* Create `server/src/logger.js` with redact() to remove secrets
**Pass if:**

* PROPOSE_EDIT includes `edits` array with **2+ files**
* Extension shows diff preview for each file
* Apply writes the files
* APPLY_EDIT_RESULT returns `applied=true` and per-file success

---

### GT-003 — Tool Runner Allowlist + Output Piping
**Goal:** Coach requests `npm test` (or configured test command), tool runs, output returns.
**Pass if:**

* Server only executes allowlisted command
* TOOL_OUTPUT is captured (stdout/stderr + exitCode)
* Output is attached to session logs
* Coach reacts to failing output (does not ignore)

---

### GT-004 — Coach Gating (Block Until Green)
**Goal:** Introduce a failing test; Coach must block completion and require fix; Player fixes; rerun tests.
**Pass if:**

* Coach returns FAIL with explicit required fixes
* Player produces patch to fix
* Coach reruns tests and returns PASS with evidence

---

### GT-005 — Secrets Safety
**Goal:** Store a provider key and ensure it never appears in logs/session exports.
**Steps:**

1. User sets API key in VS Code command
2. Run any LLM call (mock ok)
**Pass if:**

* No logs contain raw key
* redact() prevents leaks in errors
* Session export contains provider name but not key material

---

### GT-006 — Replay Session Deterministically
**Goal:** Replay a prior session from `.codemaestro/sessions/<id>/` and reproduce the same event sequence types.
**Pass if:**

* Replay runs without network calls when in `--replay` mode
* Event types sequence matches (timestamps can differ)
* Produces `replay_report.md`

---

## Scoring

MVP is not “done” unless **GT-001..GT-006** all pass.