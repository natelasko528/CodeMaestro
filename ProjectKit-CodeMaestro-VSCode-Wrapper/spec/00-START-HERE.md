# CodeMaestro Wrapper — START HERE

Build a VS Code extension + local server that orchestrates multi-agent coding workflows.
Must be provider-agnostic for end users.

Phases:
1) Protocol + local server skeleton
2) Extension UI (chat + sessions) + diff preview/apply
3) Secure key storage (SecretStorage) + provider adapters
4) Orchestration modes: Planner → Player → Coach loop with iteration cap and fresh summaries
5) Tool runner allowlist + output piping
6) Tests + packaging
