# 19 — REPLAY RULES (Determinism)

We must be able to replay sessions to debug and verify regressions.

## Requirements

* Every inbound/outbound message is appended to `events.jsonl`.
* Every tool execution is logged with full stdout/stderr.
* Every proposed edit stores a snapshot of `before/` and `after/` content (or hash references).

## Session Folder Layout

See `server/mvp/SESSION_STORE.md` for details on how session files are organized.

## Replay Modes

### Mode A: Offline Replay (no network)
* Does not call any LLM provider.
* Reads `events.jsonl` and replays the same messages back through the extension renderer.
* Produces `replay_report.md`.

### Mode B: Deterministic Re-run (optional, later)
* Re-runs tools only.
* LLM calls are replaced by recorded responses.

## Invariants (must match on replay)

* Event type sequence (INIT → USER_PROMPT → AGENT_MESSAGE → PROPOSE_EDIT → APPLY_EDIT_RESULT → TOOL_OUTPUT …).
* Per-event payload schema validity.
* Proposed edit file list and resulting file hashes.

## Redaction

* `events.jsonl` must never contain API keys.
* Any field containing `key`, `token`, `secret` must be redacted at write time.