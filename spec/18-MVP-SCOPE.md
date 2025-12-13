# 18 — MVP SCOPE (Lockbox)

This file prevents scope creep. If it’s not in MVP, it does not get built now.

## MVP Includes

1. **Local server “engine”**
   - Protocol implementation (JSONL, request/response types)
   - Orchestrator state machine (planner → player → coach)
   - Tool runner allowlist + output capture
   - Session store + export
   - Replay mode
   - Provider abstraction (stubs ok for MVP; real adapters next)

2. **VS Code extension “shell”**
   - Chat webview (basic)
   - Start session, send prompt
   - Display agent-tagged messages
   - Diff preview + apply/reject multi-file edits
   - SecretStorage plumbing (set/clear key per provider, no logging)

3. **Tests**
   - Server unit tests for:
     - protocol validation
     - tool allowlist enforcement
     - session store + replay
   - Extension minimal integration test for applying a proposed edit

## MVP Excludes (explicitly NOT now)

* Fancy session switcher UI
* Multi-agent parallel execution
* Embeddings/vector search indexing
* Cloud deployment
* Full OpenAPI client generator integration
* “One-click build app from prompt” marketing polish

## MVP Timebox Behavior

If something blocks MVP, implement the smallest safe workaround:

* Stubs for providers ok
* Mock LLM ok (as long as protocol + gating + replay works)
* UI can be basic, but diff/apply must work