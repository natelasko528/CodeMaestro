# MVP Report

## Evidence

- SessionId: **S-GT-1765656875638**
- Session artifacts: \`.codemaestro/sessions/S-GT-1765656875638/\`
- Server build: \`cd server && npm run build\`
- Server tests: \`cd server && npm test\`
- Extension build/tests: \`cd extension && npm run build && npm test\`

## Golden Tasks (automated runner)

- GT-001 (planner output + session boot): PASS
- GT-002 (2+ file propose + apply simulated): PASS
- GT-003 (allowlisted tool + output capture): PASS
- GT-005 (redaction at write time): PASS
- GT-006 (replay report + outbound sequence match): PASS

## Notes

- GT-002 “diff preview” is exercised in VS Code via the extension UI (Preview button uses \`vscode.diff\`).
- GT-004 (coach gating with a forced failure) is not automated yet; the orchestrator currently marks FAILED on non-zero tool exit and does not iterate a fix patch.

## Stderr (if any)

\`\`\`

\`\`\`
