# 20 — TOOL ALLOWLIST (MVP)

The server may only execute commands from this allowlist.

## Allowed Commands (exact)

### Node

* `npm test`
* `npm run test`
* `npm run lint`
* `npm run build`

### pnpm/yarn (only if project uses them)

* `pnpm test`
* `pnpm run lint`
* `pnpm run build`
* `yarn test`
* `yarn lint`
* `yarn build`

### Python (only if project is python)

* `pytest`
* `python -m pytest`
* `ruff check .`
* `mypy .`

## Rules

* No arbitrary shell execution.
* No pipes `|`, no redirects `>`, no `&&`, no `;`.
* Command must match allowlist EXACTLY (string compare after trimming).
* Working directory must be inside workspace root.

## Output Capture

* Capture stdout, stderr, exitCode.
* Truncate each stream at 200KB for UI, but store full in session artifacts if possible (compressed).