# Architecture — CodeMaestro Wrapper

Components:
- Extension (TypeScript): chat webview, commands, diff UI, secret storage, session view
- Local server (Node/Python): provider adapters, orchestration state machine, tool runner, patch proposer

Security:
- Keys only in SecretStorage; server requests keys via extension proxy; server never persists keys
