# Session Store (MVP)

All sessions are stored under:

```
.codemaestro/sessions/<sessionId>/
```

## Layout

* `meta.json` — metadata about the session (sessionId, createdAt, workspaceHash, version).
* `events.jsonl` — all protocol events, redacted.
* `summary.md` — rolling short state summary, updated each phase.
* `tool/` — tool executions.
  - `T-0001.json` — command, cwd, exitCode, start/end timestamps.
  - `T-0001.stdout.txt`
  - `T-0001.stderr.txt`
* `edits/` — proposed edits.
  - `E-0001/`
    - `manifest.json` (files changed, hashes)
    - `before/<filePath>`
    - `after/<filePath>`

## Redaction Rules

* Never store raw API keys.
* Redact any fields containing `key`, `token`, `secret`.
* If an error contains a key, run `redact()` before writing.