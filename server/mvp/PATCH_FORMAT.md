# Patch Format (MVP)

Server → Extension proposes edits using full file text for reliability.

## PROPOSE_EDIT payload

```
{
  "type": "PROPOSE_EDIT",
  "sessionId": "S-123",
  "payload": {
    "edits": [
      {
        "filePath": "server/src/protocol.js",
        "newText": "…full file contents…",
        "summary": "Add JSONL protocol parser + validator"
      }
    ]
  }
}
```

## APPLY_EDIT_RESULT payload (Extension → Server)

```
{
  "type": "APPLY_EDIT_RESULT",
  "sessionId": "S-123",
  "payload": {
    "applied": true,
    "fileResults": [
      { "filePath": "server/src/protocol.js", "ok": true, "error": null }
    ]
  }
}
```

## Validation Rules

* `filePath` must be relative and must not escape workspace root (`..` segments forbidden).
* `newText` must be UTF-8 and <= 2MB.
* The extension computes diff UI for preview; server does not send diffs in MVP.