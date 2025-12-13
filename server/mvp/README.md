# Server MVP (Local Engine)

## Goals

Implement the following in the MVP:

* Protocol handling using JSONL messages between extension and server.
* Orchestrator state machine as defined in `ORCHESTRATOR_STATE_MACHINE.md`.
* Tool runner that enforces the allowlist defined in `spec/20-TOOL-ALLOWLIST.md` and captures output.
* Session store and export as described in `SESSION_STORE.md`.
* Replay mode for deterministic re-runs as described in `spec/19-REPLAY-RULES.md`.

Providers can be mocked for the MVP. The priority is to get the protocol, gating, allowlist, and replay mechanism working.

## Run

```sh
npm install
npm run server
```

The `server` script should start the JSONL stdio protocol. Use `npm test` to run unit tests for the server.

## Notes

The provider abstraction should be in place, but real adapters (OpenAI, Anthropic, Gemini) can be implemented after the MVP passes all Golden Tasks.