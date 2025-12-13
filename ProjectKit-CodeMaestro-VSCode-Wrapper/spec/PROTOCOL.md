# Protocol (Extension ↔ Server)

JSON Lines over stdio or websocket.

Extension → Server:
- INIT
- USER_PROMPT
- APPLY_EDIT_RESULT
- RUN_TOOL
- KEY_REQUEST
- CANCEL

Server → Extension:
- AGENT_MESSAGE (partial allowed)
- PROPOSE_EDIT (full newText per file)
- TOOL_OUTPUT
- REQUEST_USER_INPUT
- STATUS

Edits:
Server sends `newText` per file; extension renders diff preview and applies on approval.
