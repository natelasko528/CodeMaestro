# 10 — CI/CD Pipeline

This document outlines the complete Continuous Integration/Continuous Deployment (CI/CD) pipeline for the GHL Provisioning Agent, including automated workflows, environment configurations, and deployment procedures.

## Overview

The CI/CD pipeline automates code quality checks, testing, building, and deployment across three environments:
- **Development**: Local environment with pre-commit hooks
- **Preview**: Vercel preview deployments per pull request
- **Production**: Vercel production deployment on main branch merge

---

## 1. Continuous Integration (CI) Workflow

### 1.1 CI Pipeline Stages

The GitHub Actions workflow runs the following stages in sequence:

| Stage | Tool | Purpose | Duration |
|-------|------|---------|----------|
| **Lint** | ESLint + Prettier | Code style and quality | ~2 min |
| **Type Check** | TypeScript | Type safety validation | ~3 min |
| **Unit Tests** | Vitest | Component and utility testing | ~5 min |
| **Build** | Next.js | Application bundling | ~4 min |
| **E2E Tests** | Playwright | User workflow validation | ~8 min |
| **Deploy** | Vercel | Environment deployment | ~3 min |

**Total Pipeline Duration**: ~25 minutes

### 1.2 Trigger Events

- **Push to any branch**: Runs CI pipeline (lint, type check, unit tests, build, E2E tests)
- **Push to main**: Runs full CI pipeline + deploys to production
- **Pull Request**: Runs CI pipeline + deploys to Vercel preview
- **Manual Trigger**: Via GitHub Actions UI for on-demand runs

### 1.3 Stage Details

#### Lint (ESLint + Prettier)

Enforces code style and quality standards:

```bash
# ESLint: Identifies and reports on patterns found in code
npm run lint

# Prettier: Code formatter for consistent formatting
npm run format:check
```

**Failure Conditions**:
- ESLint violations (errors)
- Prettier formatting inconsistencies
- Unused imports
- Invalid code patterns

**Auto-fix**: Run `npm run format` locally to auto-fix formatting issues.

---

#### Type Check (TypeScript)

Validates TypeScript type safety without emitting code:

```bash
npm run type-check
```

**Failure Conditions**:
- Type mismatches
- Missing type definitions
- Unsafe type operations
- Unused type definitions

---

#### Unit Tests (Vitest)

Runs component and utility unit tests with coverage reporting:

```bash
npm run test

# With coverage report
npm run test:coverage
```

**Requirements**:
- Minimum 80% code coverage
- All tests must pass
- No skipped tests in main branch

---

#### Build (Next.js)

Bundles the application and validates build integrity:

```bash
npm run build
```

**Failure Conditions**:
- Build compilation errors
- Missing environment variables
- Asset optimization failures
- Tree-shaking errors

---

#### E2E Tests (Playwright)

Executes end-to-end user workflow tests:

```bash
npm run test:e2e
```

**Test Scenarios**:
- User authentication flow
- Dashboard navigation
- Form submissions
- API integrations
- Error handling

**Browser Coverage**: Chrome, Firefox, Safari (headless)

---

## 2. Continuous Deployment (CD) Pipeline

### 2.1 Deployment Environments

#### Development Environment (Local)

**Setup**:
```bash
cp .env.example .env.local
npm install
npm run dev
```

**Database**: Local PostgreSQL or SQLite (via Prisma)

**Features**:
- Hot module reloading
- Debug logging enabled
- Mock API services
- Database seed data

---

#### Preview Environment (Vercel)

**Trigger**: Every pull request

**Characteristics**:
- Automatic deployment to unique URL
- Full feature parity with production
- Isolated database (or shared staging)
- 7-day retention

**URL Pattern**: `https://<branch-name>-<project>.vercel.app`

**Database**: Staging PostgreSQL instance with migrations applied

---

#### Production Environment (Vercel)

**Trigger**: Merge to main branch

**Characteristics**:
- Zero-downtime deployment
- Automatic rollback on failures
- CDN caching enabled
- Database backups before migration

**URL**: `https://ghl-provisioning-agent.vercel.app`

**Database**: Production PostgreSQL with automated backups

---

### 2.2 Database Migrations

Migrations are handled automatically via **Prisma Migrate**:

```bash
# Create migration
npx prisma migrate dev --name <migration_name>

# Apply migration to staging
npx prisma migrate deploy --preview-url=$VERCEL_ENV_URL

# Rollback (if needed)
npx prisma migrate resolve --rolled-back <migration_name>
```

**Migration Process**:
1. Create `.prisma` schema changes locally
2. Run `prisma migrate dev` to generate migration files
3. Commit migration files to repository
4. CI/CD automatically applies migrations on deployment

---

### 2.3 Secrets and Environment Variables

#### Vercel Environment Variables

Secrets are managed via **Vercel Environment Dashboard** (not committed to repository):

```
# .env.production (Vercel)
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=<generated-secret>
NEXTAUTH_URL=https://ghl-provisioning-agent.vercel.app
GHL_API_KEY=<api-key>
GHL_API_SECRET=<api-secret>
```

#### Local Development (Git-ignored)

```
# .env.local (NOT committed)
DATABASE_URL=postgresql://localhost:5432/ghl_dev
NEXTAUTH_SECRET=dev-secret-key
NEXTAUTH_URL=http://localhost:3000
```

#### Secret Rotation

- Quarterly review of all secrets
- Automated alerts for exposed secrets (via GitHub secret scanning)
- Immediate rotation on compromise

---

## 3. GitHub Actions Workflow YAML

### 3.1 Main Workflow File

**Location**: `.github/workflows/ci-cd.yml`

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop, '*.branch']
  pull_request:
    branches: [main, develop]
  workflow_dispatch:

env:
  NODE_VERSION: '20.x'
  PNPM_VERSION: '8.x'

jobs:
  lint:
    name: Lint Code
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run ESLint
        run: pnpm lint

      - name: Check code formatting
        run: pnpm format:check

  type-check:
    name: Type Check
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: TypeScript type check
        run: pnpm type-check

  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: ghl_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Setup test database
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/ghl_test
        run: |
          pnpm exec prisma migrate deploy

      - name: Run unit tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/ghl_test
        run: pnpm test

      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          flags: unittests
          fail_ci_if_error: true

  build:
    name: Build Application
    runs-on: ubuntu-latest
    needs: [lint, type-check, test]
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build Next.js application
        env:
          NEXT_PUBLIC_API_URL: ${{ secrets.NEXT_PUBLIC_API_URL }}
        run: pnpm build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: next-build
          path: .next
          retention-days: 1

  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: [build]
    strategy:
      matrix:
        browser: [chromium, firefox, webkit]
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps ${{ matrix.browser }}

      - name: Download build artifacts
        uses: actions/download-artifact@v3
        with:
          name: next-build
          path: .next

      - name: Run E2E tests
        env:
          PLAYWRIGHT_TEST_BASE_URL: http://localhost:3000
        run: pnpm test:e2e --project=${{ matrix.browser }}

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report-${{ matrix.browser }}
          path: playwright-report/
          retention-days: 30

  deploy-preview:
    name: Deploy to Preview
    runs-on: ubuntu-latest
    needs: [e2e-tests]
    if: github.event_name == 'pull_request'
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Deploy to Vercel Preview
        uses: vercel/action@v5
        with:
          token: ${{ secrets.VERCEL_TOKEN }}
          team-id: ${{ secrets.VERCEL_TEAM_ID }}
          project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          github-token: ${{ secrets.GITHUB_TOKEN }}

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: [e2e-tests]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Deploy to Vercel Production
        uses: vercel/action@v5
        with:
          token: ${{ secrets.VERCEL_TOKEN }}
          team-id: ${{ secrets.VERCEL_TEAM_ID }}
          project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          prod: true

      - name: Create deployment notification
        run: |
          echo "Production deployment completed at $(date)" >> $GITHUB_STEP_SUMMARY
          echo "URL: https://ghl-provisioning-agent.vercel.app" >> $GITHUB_STEP_SUMMARY
```

### 3.2 Scheduled Maintenance Workflow

**Location**: `.github/workflows/scheduled-checks.yml`

```yaml
name: Scheduled Maintenance

on:
  schedule:
    - cron: '0 2 * * 0'  # Weekly on Sunday at 2 AM UTC

jobs:
  security-audit:
    name: Security Audit
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run npm audit
        run: npm audit --audit-level=moderate

  dependency-update:
    name: Check for Updates
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Check outdated dependencies
        run: npm outdated || true

      - name: Create issue for updates
        if: failure()
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: 'Dependency Updates Available',
              body: 'Run `npm update` to update dependencies.',
            })
```

---

## 4. Local Development Workflow

### 4.1 Pre-commit Hooks

Install husky for local validation:

```bash
npm install husky --save-dev
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run lint-staged"
```

**Package.json Configuration**:
```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.md": ["prettier --write"]
  }
}
```

### 4.2 Development Commands

```bash
# Start development server
npm run dev

# Run all checks locally
npm run check-all

# Run specific checks
npm run lint
npm run format
npm run type-check
npm run test
npm run test:coverage
npm run test:e2e
npm run build
```

---

## 5. Deployment Checklist

### 5.1 Pre-Deployment Review

Before merging to main:

- [ ] All CI checks pass (lint, type check, tests, build)
- [ ] E2E tests pass on all browsers
- [ ] Code review completed and approved
- [ ] No console errors or warnings
- [ ] Test coverage >= 80%
- [ ] Performance metrics reviewed
- [ ] Database migrations reviewed and tested
- [ ] Environment variables updated in Vercel
- [ ] Secrets rotated if necessary
- [ ] Documentation updated
- [ ] CHANGELOG updated with changes

### 5.2 Deployment Verification

After production deployment:

- [ ] Health check endpoint responds (200 OK)
- [ ] Application loads without errors
- [ ] Authentication flows work correctly
- [ ] Database queries execute successfully
- [ ] No 5xx errors in error logs
- [ ] Performance metrics within baseline
- [ ] Real User Monitoring (RUM) shows normal traffic
- [ ] Third-party API integrations responding
- [ ] Webhooks triggering correctly
- [ ] Monitoring alerts configured and active

### 5.3 Rollback Procedure

If production deployment fails:

1. **Automatic**: GitHub Actions will fail, preventing merge
2. **Vercel**: Rollback to previous deployment via Vercel dashboard
3. **Database**: Prisma migrations are reversible via:
   ```bash
   npx prisma migrate resolve --rolled-back <migration_name>
   ```
4. **Communication**: Post incident summary in #deployments Slack channel

---

## 6. Monitoring and Observability

### 6.1 CI Pipeline Monitoring

- **GitHub Actions Dashboard**: All workflow runs visible at `/actions`
- **Branch Protection**: Main branch requires all checks to pass
- **Notifications**: Slack/email on workflow failures
- **Metrics**: Track pipeline duration, failure rates, test coverage

### 6.2 Production Monitoring

- **Vercel Analytics**: Real User Monitoring (RUM) and Web Vitals
- **Error Tracking**: Sentry integration for error reporting
- **Logging**: CloudWatch or equivalent for application logs
- **Uptime**: StatusPage.io or equivalent for status page

### 6.3 Database Monitoring

- **Query Performance**: Monitor slow queries (> 1s)
- **Connections**: Track active connections vs. pool limits
- **Backups**: Automated daily backups, tested weekly
- **Replication**: Monitor replica lag in production

---

## 7. Troubleshooting

### 7.1 Common CI Failures

| Issue | Solution |
|-------|----------|
| ESLint errors | Run `npm run format` to auto-fix |
| Type errors | Check TS config, run `npm run type-check` |
| Test failures | Run tests locally with `npm test` and debug |
| Build failure | Check for console errors, verify all imports |
| E2E flakiness | Increase timeouts, check async operations |

### 7.2 Common Deploy Failures

| Issue | Solution |
|-------|----------|
| Missing env var | Add to Vercel environment variables |
| Database migration fails | Test migration locally, check connection |
| Vercel deployment fails | Check build logs, review recent changes |
| Performance regression | Review bundle size, check for N+1 queries |

---

## 8. Best Practices

### 8.1 Commit Messages

Follow conventional commits format:
```
feat: add user authentication
fix: resolve login redirect issue
docs: update API documentation
test: add unit tests for auth
chore: update dependencies
```

### 8.2 Branch Strategy

- `main`: Production-ready code
- `develop`: Integration branch
- Feature branches: `feature/description`
- Bugfix branches: `fix/description`
- Release branches: `release/v1.0.0`

### 8.3 Code Review Standards

- Minimum 1 approval required
- All CI checks must pass
- Coverage should not decrease
- No hardcoded secrets or credentials
- Performance impact assessed

---

## 9. References

- **GitHub Actions**: https://docs.github.com/en/actions
- **Vercel Deployment**: https://vercel.com/docs
- **Prisma Migrate**: https://www.prisma.io/docs/concepts/components/prisma-migrate
- **Playwright Testing**: https://playwright.dev
- **Conventional Commits**: https://www.conventionalcommits.org
