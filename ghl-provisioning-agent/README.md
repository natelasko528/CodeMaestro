# GHL Autopilot

Zero-touch GoHighLevel sub-account provisioning for agencies and SaaS platforms.

## Getting Started

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

## Security

See [spec/11-SECURITY-PRIVACY.md](spec/11-SECURITY-PRIVACY.md) for security guidelines.

## License

Proprietary - All rights reserved
