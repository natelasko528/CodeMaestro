# 16 — Secrets & API Keys (Required)

## Generic requirements
- Never store plaintext keys in repo.
- Never print keys in logs/chat/errors.
- Use `.env.example` placeholders only.

## VS Code Wrapper (product)
- Store keys in `vscode.SecretStorage`.
- Provide commands to set/clear keys per provider.
- The server must not persist keys; extension proxies access.

## Dev / CLI
- Read keys from env or OS keychain.
- `.env` must be gitignored.
