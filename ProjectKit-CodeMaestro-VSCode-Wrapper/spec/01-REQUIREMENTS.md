# Requirements — CodeMaestro VS Code Wrapper

Must-haves:
- R-001 Chat UI inside VS Code with agent-tagged messages
- R-002 Multi-file propose-edit + diff preview + apply/reject
- R-003 Secure API key storage (VS Code SecretStorage) per provider
- R-004 Provider abstraction (OpenAI/Anthropic/Gemini + placeholders)
- R-005 Orchestration modes (planner/player/coach) + iteration cap + fresh summaries
- R-006 Tool runner allowlist (test/lint/build) + output to agents
- R-007 Session logging/export under `.codemaestro/sessions/` (no secrets)

Constraints:
- Cross-platform
- Minimal friction
- No vendor lock-in
