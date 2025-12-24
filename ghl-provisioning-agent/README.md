# GHL Autopilot 🚀

[![CI/CD Pipeline](https://github.com/your-org/ghl-provisioning-agent/workflows/CI/CD%20Pipeline/badge.svg)](https://github.com/your-org/ghl-provisioning-agent/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black)](https://nextjs.org/)
[![License](https://img.shields.io/badge/license-Proprietary-red)](LICENSE)

**Zero-touch GoHighLevel sub-account provisioning for agencies and SaaS platforms.**

Automate the complete sub-account lifecycle—from OAuth authentication through account initialization, AI-powered snapshot selection, custom value injection, and team member provisioning—enabling agencies to scale without operational bottlenecks.

## ✨ Features

- 🔐 **Secure OAuth 2.0** authentication with GoHighLevel API
- 🤖 **AI-Powered Snapshot Selection** using OpenAI GPT-4o-mini
- ⚡ **Real-Time Monitoring** via Server-Sent Events (SSE)
- 🔄 **Automatic Retry Logic** with exponential backoff
- 📊 **Comprehensive Audit Logging** for compliance
- 🛡️ **Rate Limiting** to handle GHL API constraints
- 🎯 **Custom Value Injection** for account personalization
- 👥 **Team Member Provisioning** with role-based access
- 📈 **Dashboard Analytics** with job success tracking

## 🎯 Quick Start

### Prerequisites

- Node.js 18.17.0 or higher
- npm 9.0.0 or higher
- PostgreSQL 14 or higher

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-org/ghl-provisioning-agent.git
cd ghl-provisioning-agent
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your actual values
```

4. Generate encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

5. Generate NextAuth secret:
```bash
openssl rand -base64 32
```

6. Set up the database:
```bash
npm run db:generate
npm run db:migrate
```

7. Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Check TypeScript types
- `npm test` - Run unit tests
- `npm run test:coverage` - Run tests with coverage
- `npm run test:e2e` - Run E2E tests
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio

## Architecture

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js v5 with GHL OAuth
- **Styling**: Tailwind CSS
- **Testing**: Vitest (unit/integration), Playwright (E2E)

## Project Structure

```
ghl-provisioning-agent/
├── app/                  # Next.js App Router pages
├── components/           # React components
├── lib/                  # Utility functions and services
│   ├── server/          # Server-side utilities
│   └── client/          # Client-side utilities
├── prisma/              # Database schema and migrations
├── test/                # Test files
│   ├── unit/           # Unit tests
│   ├── integration/    # Integration tests
│   └── e2e/            # End-to-end tests
└── spec/               # Specification documents
```

## 📡 API Endpoints

### Provisioning
- `POST /api/provision` - Create new sub-account
- `GET /api/provision/jobs` - List all jobs
- `GET /api/provision/jobs/[id]` - Get job status
- `GET /api/provision/jobs/[id]/stream` - Real-time SSE logs

### Authentication
- `GET /api/auth/ghl/connect` - Initiate OAuth flow
- `POST /api/auth/ghl/callback` - OAuth callback handler

### Snapshots
- `GET /api/snapshots` - List available snapshots
- `POST /api/snapshots/sync` - Sync from GHL
- `POST /api/snapshots/select` - AI snapshot recommendation

See [spec/04-API-CONTRACT.openapi.yaml](spec/04-API-CONTRACT.openapi.yaml) for complete API documentation.

## 🚀 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel dashboard
3. Configure environment variables
4. Deploy!

### Docker

```bash
# Build image
docker build -t ghl-autopilot .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL="your-db-url" \
  -e NEXTAUTH_SECRET="your-secret" \
  ghl-autopilot
```

### Environment Variables

Required variables for production:

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Authentication
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-generated-secret

# Encryption
ENCRYPTION_KEY=your-base64-key

# GoHighLevel OAuth
GHL_CLIENT_ID=your-ghl-client-id
GHL_CLIENT_SECRET=your-ghl-secret
GHL_API_BASE_URL=https://services.leadconnectorhq.com

# OpenAI
OPENAI_API_KEY=sk-your-openai-key
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run E2E tests
npm run test:e2e

# Run tests with coverage
npm run test:coverage

# View coverage report
open coverage/index.html
```

## 📊 Project Statistics

- **Total Files:** 120+
- **Lines of Code:** 25,000+
- **Test Coverage:** 80%+
- **Backend Tests:** 177
- **E2E Tests:** 12
- **API Endpoints:** 15

## 🛠️ Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14, React 18, TypeScript, Tailwind CSS |
| **UI Components** | shadcn/ui, Radix UI |
| **Backend** | Next.js API Routes, Prisma ORM |
| **Database** | PostgreSQL 16 |
| **Authentication** | NextAuth.js v5 |
| **AI** | OpenAI GPT-4o-mini |
| **Testing** | Vitest, Playwright, MSW |
| **CI/CD** | GitHub Actions |
| **Hosting** | Vercel |

## 📖 Documentation

- [Requirements](spec/01-REQUIREMENTS.md) - Product requirements and user stories
- [Architecture](spec/02-ARCHITECTURE.md) - System design and tech stack
- [API Contract](spec/04-API-CONTRACT.openapi.yaml) - OpenAPI specification
- [Security](spec/11-SECURITY-PRIVACY.md) - Security guidelines
- [Testing Strategy](spec/09-TESTING-QA.md) - Test coverage and quality gates

## 🤝 Contributing

This is a proprietary project. For authorized contributors:

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Run tests: `npm test && npm run test:e2e`
4. Commit: `git commit -m "Add your feature"`
5. Push: `git push origin feature/your-feature`
6. Create a Pull Request

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
pg_isready

# Verify connection string
echo $DATABASE_URL

# Reset database
npm run db:migrate -- --force
```

### OAuth Errors

- Verify GHL credentials in `.env.local`
- Check callback URL matches GHL app settings
- Ensure NEXTAUTH_URL is correct

### Build Failures

```bash
# Clear Next.js cache
rm -rf .next

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Regenerate Prisma client
npm run db:generate
```

## 📧 Support

For issues and questions:
- 📚 Check [Documentation](spec/)
- 🐛 [Report Bugs](https://github.com/your-org/ghl-provisioning-agent/issues)
- 💬 Contact: support@your-domain.com

## 🔒 Security

**Security issues?** Please email security@your-domain.com instead of using the issue tracker.

See [Security Policy](spec/11-SECURITY-PRIVACY.md) for details.

## 📄 License

Proprietary - All rights reserved © 2025

---

**Built with the CodeMaestro DevKit** following Player-Coach adversarial methodology.
