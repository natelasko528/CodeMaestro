# AI Build Prompt — NEXT STEP (Claude Code / Opus 4.5)

You are Opus 4.5 running inside Claude Code. Build the **MVP next step** exactly.

## Read first

* `spec/18-MVP-SCOPE.md` (scope lock)
* `spec/17-GOLDEN-TASKS.md` (must pass)
* `spec/20-TOOL-ALLOWLIST.md` (security)
* `spec/19-REPLAY-RULES.md` (determinism)

## Implement (in this order)

### 1) Server MVP engine

Create `/server/` with:

* Protocol (JSONL messages, schema validation)
* Orchestrator state machine per `server/mvp/ORCHESTRATOR_STATE_MACHINE.md`
* Patch proposer format per `server/mvp/PATCH_FORMAT.md`
* Tool runner allowlist per `spec/20-TOOL-ALLOWLIST.md`
* Session store per `server/mvp/SESSION_STORE.md`
* Replay mode (`--replay <sessionId>`)

Providers:

* Use a provider abstraction, but MVP may include a MockProvider returning deterministic outputs.
* Ensure redaction at log-write time.

### 2) VS Code extension MVP shell

Create `/extension/` with:

* Chat webview (basic) and message stream display
* Start session, send prompt, show agent-tagged messages
* Diff preview for `PROPOSE_EDIT` + apply/reject multi-file
* `SecretStorage` commands: set/clear key per provider (no logs)

Critical: The server must **not** persist keys. The extension proxies key requests.

### 3) Tests

* Server unit tests for:
  * allowlist enforcement
  * protocol validation
  * session store + replay
* Extension test that applying a proposed edit writes a workspace file

### 4) Prove MVP by running Golden Tasks

Run `GT-001..GT-006`. If any fail, fix until they pass.
Produce `MVP_REPORT.md` with evidence (commands + outputs) and links/paths to session artifacts.

## Output constraints

* No secrets in logs or repo
* No scope creep beyond MVP
* Commit in small steps with clear messages