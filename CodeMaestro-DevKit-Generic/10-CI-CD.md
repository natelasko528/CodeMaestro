# 10 — CI/CD (Template)

CI steps:
1) Install deps
2) Lint
3) Unit tests
4) Build
5) Optional Playwright smoke

CD:
- Target: {{DEPLOY_TARGET}}
- Secrets: CI secret manager
