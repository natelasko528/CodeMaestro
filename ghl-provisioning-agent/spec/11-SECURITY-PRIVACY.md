# 11 — SECURITY & PRIVACY

## Table of Contents

1. [Overview](#overview)
2. [Threat Model](#threat-model)
3. [Authentication & Authorization](#authentication--authorization)
4. [Encryption & Token Management](#encryption--token-management)
5. [Transport Security](#transport-security)
6. [Session Management](#session-management)
7. [API Security](#api-security)
8. [Input Validation](#input-validation)
9. [Data Protection](#data-protection)
10. [Secrets Management](#secrets-management)
11. [GDPR Compliance](#gdpr-compliance)
12. [Audit Logging](#audit-logging)
13. [Security Checklist](#security-checklist)

---

## Overview

The GHL Provisioning Agent handles sensitive OAuth tokens, agency data, and user information. This document defines comprehensive security controls across authentication, encryption, transport, API, and data protection layers. All security measures are mandatory and enforced at build/deployment time.

**Key Principles:**
- Defense in depth (multiple overlapping controls)
- Fail-secure (deny by default)
- Zero trust architecture
- Encryption at rest and in transit
- Least privilege access
- Complete audit trails

---

## Threat Model

### Assets at Risk

1. **OAuth 2.0 Tokens** (GHL, Salesforce, HubSpot)
   - Confidentiality: CRITICAL
   - Integrity: CRITICAL
   - Availability: HIGH

2. **Agency Data** (configuration, credentials, identifiers)
   - Confidentiality: CRITICAL
   - Integrity: HIGH
   - Availability: HIGH

3. **User Authentication Credentials**
   - Confidentiality: CRITICAL
   - Integrity: CRITICAL
   - Availability: MEDIUM

4. **Audit Logs** (provisioning history, access patterns)
   - Confidentiality: HIGH
   - Integrity: CRITICAL
   - Availability: MEDIUM

### Threat Scenarios

| Threat | Impact | Likelihood | Mitigation |
|--------|--------|-----------|-----------|
| OAuth token theft via man-in-the-middle | CRITICAL | MEDIUM | TLS 1.3+, Certificate pinning, HSTS |
| Stored token compromise (database breach) | CRITICAL | MEDIUM | AES-256-GCM encryption, HSM-backed keys |
| SQL injection exposing token data | CRITICAL | LOW | Prisma ORM parameterization, input validation |
| Session hijacking/replay attacks | HIGH | MEDIUM | Secure cookies, CSRF tokens, session rotation |
| Brute force authentication attacks | HIGH | MEDIUM | Rate limiting, account lockout, MFA-ready |
| Unauthorized data access | CRITICAL | MEDIUM | RBAC, attribute-based access control, audit logs |
| Credentials in logs/error messages | HIGH | MEDIUM | Log sanitization, secret detection in CI/CD |
| Token expiry/stale credentials | HIGH | HIGH | Automatic token refresh, rotation strategy |
| Insecure CORS configuration | HIGH | MEDIUM | Strict CORS whitelist, no wildcard origins |
| Unvalidated input leading to injection | HIGH | MEDIUM | Zod schema validation, type safety |

### Attack Surface

- **API Endpoints**: Rate limiting, authentication required
- **Database**: Encryption at rest, parameterized queries, minimal permissions
- **Client Storage**: Secure cookies (httpOnly, Secure, SameSite), memory-only tokens
- **Logs**: PII/secret detection and masking
- **Environment**: Secrets in .env.local only, never committed

---

## Authentication & Authorization

### OAuth 2.0 Integration

**Supported Providers:**
- GHL (internal OAuth 2.0)
- Salesforce OAuth 2.0
- HubSpot OAuth 2.0

**Authorization Code Flow (Recommended):**
1. User clicks "Connect [Provider]"
2. Agent redirects to provider's authorization endpoint
3. User grants consent
4. Provider redirects back with authorization code
5. Agent exchanges code for tokens (backend only, never expose to client)
6. Agent stores encrypted tokens in database
7. Agent issues secure session cookie to browser

**Implementation:**
```typescript
// pages/api/auth/[...nextauth].ts
import NextAuth from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    {
      id: "ghl",
      name: "GHL",
      type: "oauth",
      authorization: {
        url: "https://api.gohighlevel.com/oauth/authorize",
        params: {
          scope: "agency.profile agency.campaign",
          state: generateSecureRandomString(32),
        },
      },
      token: "https://api.gohighlevel.com/oauth/token",
      userinfo: "https://api.gohighlevel.com/oauth/user",
      clientId: process.env.GHL_CLIENT_ID,
      clientSecret: process.env.GHL_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: false,
    },
  ],
  session: {
    strategy: "jwt",
    maxAge: 86400, // 24 hours
    updateAge: 3600, // Refresh every hour
  },
  jwt: {
    encryption: true,
    maxAge: 86400,
    secret: process.env.NEXTAUTH_SECRET,
  },
  callbacks: {
    jwt: encryptTokensInJWT,
    session: addEncryptedTokensToSession,
  },
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
};

export default NextAuth(authOptions);
```

### Role-Based Access Control (RBAC)

**Roles:**
- `ADMIN`: Full system access, can manage agencies, users, logs
- `AGENCY_OWNER`: Can provision/deprovision their own agency
- `AGENCY_USER`: Limited access to specific agency operations
- `VIEWER`: Read-only access to own agency data

**Enforcement:**
```typescript
// middleware/requireRole.ts
export function requireRole(...allowedRoles: Role[]) {
  return async (req: NextApiRequest, res: NextApiResponse, next) => {
    const session = await getSession({ req });

    if (!session?.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userRole = session.user.role;
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    next();
  };
}

// Usage: @requireRole(ADMIN, AGENCY_OWNER)
```

### Multi-Factor Authentication (MFA)

- MFA enforced for accounts with admin roles
- TOTP (Time-based One-Time Password) via authenticator apps
- Backup codes provided during MFA setup
- Stored hashed in database, never in logs

---

## Encryption & Token Management

### OAuth Token Encryption

**Algorithm:** AES-256-GCM (Galois/Counter Mode)

**Key Management:**
- Master key stored in environment variable: `ENCRYPTION_KEY` (32 bytes, base64-encoded)
- Never commit encryption key to repository
- Rotate keys quarterly; support multiple active keys via key versioning
- Use AWS KMS or HashiCorp Vault for production key management

**Implementation:**
```typescript
// lib/encryption.ts
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const ENCODING = "base64";
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;
const IV_LENGTH = 12;

export function encryptToken(
  plaintext: string,
  encryptionKey?: string
): string {
  const key = Buffer.from(
    encryptionKey || process.env.ENCRYPTION_KEY!,
    "base64"
  );

  if (key.length !== 32) {
    throw new Error("Encryption key must be 32 bytes (256 bits)");
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", ENCODING);
  encrypted += cipher.final(ENCODING);

  const tag = cipher.getAuthTag();

  // Format: iv + tag + ciphertext (all base64)
  return Buffer.concat([iv, tag, Buffer.from(encrypted, ENCODING)])
    .toString(ENCODING);
}

export function decryptToken(
  ciphertext: string,
  encryptionKey?: string
): string {
  const key = Buffer.from(
    encryptionKey || process.env.ENCRYPTION_KEY!,
    "base64"
  );

  const buffer = Buffer.from(ciphertext, ENCODING);
  const iv = buffer.slice(0, IV_LENGTH);
  const tag = buffer.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buffer.slice(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, ENCODING, "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
```

### Token Storage

**In Database:**
- OAuth tokens stored encrypted with AES-256-GCM
- Refresh tokens stored separately from access tokens
- Token metadata (issuer, expiry, scope) stored separately
- Never store plaintext tokens

**In Memory/Session:**
- Access tokens never stored in localStorage (XSS vulnerability)
- Access tokens stored in memory-only JavaScript variable or secure cookie
- Refresh tokens in httpOnly, Secure cookies (inaccessible to JavaScript)
- Session tokens encrypted and signed by NextAuth.js

**Example Database Schema:**
```prisma
model OAuthToken {
  id              String   @id @default(cuid())
  agencyId        String
  provider        String   // "ghl", "salesforce", "hubspot"
  accessToken     String   // Encrypted with AES-256-GCM
  refreshToken    String?  // Encrypted with AES-256-GCM
  expiresAt       DateTime
  tokenScope      String   // Space-separated scopes
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  agency          Agency   @relation(fields: [agencyId], references: [id])

  @@index([agencyId, provider])
  @@index([expiresAt]) // For token rotation queries
}
```

### Token Rotation Strategy

**Automatic Refresh Before Expiry:**
1. Access tokens typically valid 1 hour
2. Token rotated proactively 15 minutes before expiry
3. Refresh token exchange handled server-side only
4. Failed refresh triggers re-authentication flow
5. Rotation logged for audit trail

**Implementation:**
```typescript
// lib/tokenRotation.ts
export async function ensureValidToken(
  agencyId: string,
  provider: string
): Promise<string> {
  const oauthToken = await prisma.oAuthToken.findUnique({
    where: {
      agencyId_provider: { agencyId, provider },
    },
  });

  if (!oauthToken) {
    throw new Error("Token not found");
  }

  const now = new Date();
  const rotationThreshold = new Date(now.getTime() + 15 * 60 * 1000); // 15 min

  // Token expires soon, refresh it
  if (oauthToken.expiresAt < rotationThreshold) {
    return await refreshToken(oauthToken);
  }

  return decryptToken(oauthToken.accessToken);
}

async function refreshToken(oauthToken: OAuthToken): Promise<string> {
  const providerConfig = getProviderConfig(oauthToken.provider);

  const response = await fetch(providerConfig.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: decryptToken(oauthToken.refreshToken!),
      client_id: providerConfig.clientId,
      client_secret: providerConfig.clientSecret,
    }),
  });

  const { access_token, refresh_token, expires_in } = await response.json();

  // Update database with new tokens
  const updated = await prisma.oAuthToken.update({
    where: { id: oauthToken.id },
    data: {
      accessToken: encryptToken(access_token),
      refreshToken: encryptToken(refresh_token),
      expiresAt: new Date(Date.now() + expires_in * 1000),
      updatedAt: new Date(),
    },
  });

  // Audit log
  await auditLog("TOKEN_ROTATED", {
    agencyId: oauthToken.agencyId,
    provider: oauthToken.provider,
  });

  return access_token;
}
```

---

## Transport Security

### HTTPS/TLS 1.3 Only

**Configuration:**

1. **Server Configuration (Next.js):**
```javascript
// next.config.js
module.exports = {
  experimental: {
    serverComponentsExternalPackages: [],
  },
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains; preload",
        },
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        {
          key: "X-Frame-Options",
          value: "DENY",
        },
        {
          key: "X-XSS-Protection",
          value: "1; mode=block",
        },
        {
          key: "Referrer-Policy",
          value: "strict-origin-when-cross-origin",
        },
        {
          key: "Content-Security-Policy",
          value: `default-src 'self';
                   script-src 'self' 'unsafe-inline' 'unsafe-eval';
                   style-src 'self' 'unsafe-inline';
                   img-src 'self' data: https:;
                   font-src 'self';
                   connect-src 'self' https://api.gohighlevel.com;
                   frame-ancestors 'none'`,
        },
      ],
    },
  ],
};
```

2. **Environment Configuration:**
   - TLS 1.3 minimum version
   - Disable TLS 1.0, 1.1, 1.2 in production
   - Strong cipher suites only (AEAD, PFS required)
   - Certificate must be valid and not self-signed
   - HSTS header with preload

3. **Certificate Management:**
   - Use Let's Encrypt with auto-renewal via Certbot/ACME
   - Monitor certificate expiry 30 days in advance
   - Pin certificate for critical API endpoints
   - Implement certificate transparency checking

### Certificate Pinning (Optional, for High Security)

```typescript
// lib/secureHttpClient.ts
import https from "https";
import crypto from "crypto";

const pinnedCertificates = {
  "api.gohighlevel.com": [
    "sha256/abc123...", // Public key hash
    "sha256/def456...", // Backup public key hash
  ],
};

export function getSecureHttpsAgent() {
  return new https.Agent({
    rejectUnauthorized: true,
    minVersion: "TLSv1.3",
    maxVersion: "TLSv1.3",
    ciphers: [
      "TLS_AES_256_GCM_SHA384",
      "TLS_CHACHA20_POLY1305_SHA256",
      "TLS_AES_128_GCM_SHA256",
    ].join(":"),
  });
}
```

---

## Session Management

### NextAuth.js Configuration

**Session Strategy:** JWT with encryption (recommended over database sessions)

**Configuration Details:**
```typescript
// pages/api/auth/[...nextauth].ts
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET, // 32+ character random string
  session: {
    strategy: "jwt",
    maxAge: 86400, // 24 hours
    updateAge: 3600, // Refresh session every hour
  },
  jwt: {
    secret: process.env.NEXTAUTH_JWT_SECRET,
    encryption: true,
    maxAge: 86400,
  },
  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // HTTPS only
        sameSite: "lax", // CSRF protection
        path: "/",
        maxAge: 86400,
      },
    },
    callbackUrl: {
      name: "next-auth.callback-url",
      options: {
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      },
    },
  },
  providers: [
    // OAuth providers configured here
  ],
  callbacks: {
    /**
     * Encrypt sensitive data in JWT (e.g., OAuth tokens)
     */
    async jwt({ token, account, user, isNewUser }) {
      if (account) {
        // First sign-in, store encrypted tokens
        const oauthToken = await prisma.oAuthToken.create({
          data: {
            agencyId: user.agencyId,
            provider: account.provider,
            accessToken: encryptToken(account.access_token),
            refreshToken: encryptToken(account.refresh_token),
            expiresAt: new Date(
              (account.expires_at ?? 0) * 1000
            ),
            tokenScope: account.scope || "",
          },
        });

        token.oauthTokenId = oauthToken.id;
      }

      return token;
    },

    /**
     * Add encrypted tokens to session object
     */
    async session({ session, token }) {
      session.user.id = token.sub;
      session.user.oauthTokenId = token.oauthTokenId;
      return session;
    },

    /**
     * Validate redirect URLs (prevent open redirect)
     */
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  events: {
    /**
     * Log authentication events for audit trail
     */
    async signIn({ user, account, profile, isNewUser }) {
      await auditLog("USER_SIGN_IN", {
        userId: user.id,
        provider: account?.provider,
      });
    },

    async signOut({ token }) {
      await auditLog("USER_SIGN_OUT", {
        userId: token.sub,
      });
    },
  },
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
};
```

### Session Security Properties

- **httpOnly**: JavaScript cannot access session cookies (prevents XSS token theft)
- **Secure**: Cookies only sent over HTTPS
- **SameSite=Lax**: CSRF protection (allow top-level navigation, block form submissions from external sites)
- **MaxAge**: 24 hours (reasonable session duration)
- **UpdateAge**: Refresh token every hour to prevent stale sessions

### CSRF Protection

- NextAuth.js provides CSRF tokens automatically
- Validate CSRF token on state-changing requests (POST, PUT, DELETE)
- Implementation:
```typescript
// middleware/csrfProtection.ts
import { csrfProtect } from "csrf";

export async function verifyCsrfToken(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST" || req.method === "PUT" || req.method === "DELETE") {
    const token = req.headers["x-csrf-token"] as string;
    const valid = csrfProtect.verify(token);

    if (!valid) {
      return res.status(403).json({ error: "CSRF token validation failed" });
    }
  }
}
```

---

## API Security

### Rate Limiting

**Strategy:** Multi-level rate limiting

1. **Per-IP Rate Limit:**
   - 100 requests per minute per IP
   - Applied globally to all endpoints
   - Uses Redis for distributed counting
   - Implements sliding window algorithm

2. **Per-Agency Rate Limit:**
   - 1000 requests per minute per agency
   - Applied to authenticated endpoints
   - Prevents single agency from monopolizing resources
   - Tracked via agency ID from JWT

3. **Per-User Rate Limit:**
   - 500 requests per minute per user
   - Applied to provisioning endpoints
   - Prevents runaway scripts

**Implementation:**
```typescript
// lib/rateLimit.ts
import Redis from "ioredis";
import { nanoid } from "nanoid";

const redis = new Redis(process.env.REDIS_URL);

async function checkRateLimit(
  key: string,
  limit: number,
  window: number = 60 // seconds
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const bucket = `${key}:${now}`;

  const count = await redis.incr(bucket);

  if (count === 1) {
    await redis.expire(bucket, window + 1);
  }

  return count <= limit;
}

// Middleware for Express/Next.js
export function createRateLimitMiddleware(
  keyGenerator: (req: NextApiRequest) => string,
  limit: number,
  window?: number
) {
  return async (req: NextApiRequest, res: NextApiResponse, next) => {
    const key = keyGenerator(req);
    const allowed = await checkRateLimit(key, limit, window);

    if (!allowed) {
      res.setHeader("Retry-After", window || 60);
      return res.status(429).json({
        error: "Too many requests",
        retryAfter: window || 60,
      });
    }

    next();
  };
}

// Usage in API routes
export const rateLimitByIp = createRateLimitMiddleware(
  (req) => `ratelimit:ip:${req.ip}`,
  100,
  60
);

export const rateLimitByAgency = createRateLimitMiddleware(
  (req) => `ratelimit:agency:${req.session.user.agencyId}`,
  1000,
  60
);
```

### API Authentication

All API endpoints require authentication:

```typescript
// lib/apiAuth.ts
import { getServerSession } from "next-auth/next";

export async function protectApiRoute(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return session;
}

// Usage
export async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await protectApiRoute(req, res);
  if (!session) return; // Response already sent

  // Process request with authenticated user
}
```

### Request/Response Validation

- All API endpoints validate request payloads with Zod
- All API endpoints define response schemas
- Type-safe responses prevent information leakage
- OpenAPI documentation generated from schemas

---

## Input Validation

### Zod Schema Validation

All user inputs validated at API boundaries:

```typescript
// schemas/provisioning.ts
import { z } from "zod";

export const createAgencySchema = z.object({
  name: z.string().min(1).max(256),
  businessType: z.enum(["B2B", "B2C", "SaaS"]),
  industry: z.string().min(1).max(100),
  website: z.string().url().optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
  address: z.object({
    street: z.string().max(256),
    city: z.string().max(100),
    state: z.string().max(100),
    postalCode: z.string().max(20),
    country: z.string().length(2), // ISO 3166-1 alpha-2
  }),
});

export const updateAgencySchema = createAgencySchema.partial();

export const listAgenciesSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["name", "createdAt", "updatedAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// API endpoint with validation
export async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const validated = createAgencySchema.parse(req.body);
    // Process validated data
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.errors,
      });
    }
    throw error;
  }
}
```

### XSS Prevention

- Never use `dangerouslySetInnerHTML` in React components
- Sanitize user-generated content with DOMPurify:
```typescript
import DOMPurify from "isomorphic-dompurify";

export function SafeHtml({ content }: { content: string }) {
  const clean = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "p", "br"],
    ALLOWED_ATTR: [],
  });

  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}
```

### Command Injection Prevention

- Never use `eval()`, `Function()`, or dynamic string execution
- Use parameterized queries (Prisma ORM)
- Sanitize shell arguments if required:
```typescript
import { execFile } from "child_process";

// Bad: shell=true allows injection
execFile("rm", ["-rf", userInput], { shell: true }); // DANGEROUS

// Good: explicit array prevents injection
execFile("rm", ["-rf", userInput]); // Safe
```

---

## Data Protection

### SQL Injection Prevention

Prisma ORM prevents SQL injection through:
- Parameterized queries (all user inputs are parameters)
- Type-safe queries (catch mismatches at build time)
- No string concatenation for building queries

```typescript
// Prisma automatically parameterizes this query
const agencies = await prisma.agency.findMany({
  where: {
    name: req.body.name, // Parameter, not string concatenation
  },
});

// Never do this (Prisma doesn't support it anyway)
const query = `SELECT * FROM agency WHERE name = '${req.body.name}'`; // Never!
```

### Database Encryption

- Implement Transparent Data Encryption (TDE) at database level
- PostgreSQL: Use pgcrypto extension for column-level encryption
- MongoDB: Use Client-Side Field Level Encryption
- AWS RDS: Enable encryption at rest (KMS-managed)

### Sensitive Data Masking in Logs

```typescript
// lib/logger.ts
const SENSITIVE_FIELDS = [
  "accessToken",
  "refreshToken",
  "password",
  "apiKey",
  "secret",
  "ssn",
  "creditCard",
];

export function sanitizeForLogging(obj: any): any {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }

  const sanitized = Array.isArray(obj) ? [...obj] : { ...obj };

  for (const key in sanitized) {
    if (SENSITIVE_FIELDS.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof sanitized[key] === "object") {
      sanitized[key] = sanitizeForLogging(sanitized[key]);
    }
  }

  return sanitized;
}

logger.info("Processing request", sanitizeForLogging(req.body));
```

---

## Secrets Management

### Environment Variables (.env.local)

**Required Secrets:**

```
# NextAuth Configuration
NEXTAUTH_SECRET=<32+ character random string>
NEXTAUTH_JWT_SECRET=<32+ character random string>
NEXTAUTH_URL=https://your-domain.com

# OAuth Credentials
GHL_CLIENT_ID=<your-ghl-client-id>
GHL_CLIENT_SECRET=<your-ghl-client-secret>
SALESFORCE_CLIENT_ID=<your-sf-client-id>
SALESFORCE_CLIENT_SECRET=<your-sf-client-secret>
HUBSPOT_CLIENT_ID=<your-hubspot-client-id>
HUBSPOT_CLIENT_SECRET=<your-hubspot-client-secret>

# Encryption
ENCRYPTION_KEY=<32-byte base64-encoded key>

# Database
DATABASE_URL=postgresql://user:password@host/database

# Redis (for rate limiting, sessions)
REDIS_URL=redis://user:password@host:6379

# Third-party APIs
SENDGRID_API_KEY=<sendgrid-key>
STRIPE_SECRET_KEY=<stripe-secret>

# Logging/Observability
SENTRY_DSN=<sentry-dsn>
LOG_LEVEL=info
```

### Secrets Generation

Generate secrets securely:

```bash
# Generate NEXTAUTH_SECRET (recommended: 32+ characters)
openssl rand -base64 32

# Generate ENCRYPTION_KEY (must be exactly 32 bytes when decoded from base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Generate NEXTAUTH_JWT_SECRET
openssl rand -base64 32
```

### Secrets in CI/CD

- Store secrets in GitHub Secrets (for GitHub Actions) or equivalent
- Never log secrets or pass them as arguments
- Rotate secrets every 90 days
- Use short-lived credentials for service accounts
- Implement secret scanning in pre-commit hooks:

```bash
# .git/hooks/pre-commit
#!/bin/bash
if git diff --cached | grep -i "secret\|password\|apikey\|token"; then
  echo "Error: Potential secret detected in commit"
  exit 1
fi
```

Or use Husky with git-secrets:

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "git secrets --pre_commit_hook"
    }
  }
}
```

---

## GDPR Compliance

### Data Retention Policy

**Agency Data:**
- Retained for duration of contract + 90 days post-termination
- Configurable per agency in database

**User Data:**
- Personal information retained only while user is active
- Automatically deleted 180 days after account deactivation
- Explicit deletion on user request

**Audit Logs:**
- Retained for 2 years for compliance audits
- Anonymized after 1 year (no personally identifiable information)

**OAuth Tokens:**
- Deleted when agency is deleted
- Revoked on token endpoint immediately upon deletion

**Implementation:**
```typescript
// lib/dataRetention.ts
import { CronJob } from "cron";

export function scheduleDataRetentionJobs() {
  // Delete inactive users
  new CronJob("0 2 * * *", async () => {
    const inactiveDate = new Date();
    inactiveDate.setDate(inactiveDate.getDate() - 180);

    const inactiveUsers = await prisma.user.findMany({
      where: {
        deletedAt: null,
        lastActiveAt: { lt: inactiveDate },
      },
    });

    for (const user of inactiveUsers) {
      await deleteUserData(user.id);
    }

    logger.info(`Deleted data for ${inactiveUsers.length} inactive users`);
  }).start();

  // Anonymize old audit logs
  new CronJob("0 3 * * 0", async () => {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);

    await prisma.auditLog.updateMany({
      where: { createdAt: { lt: cutoffDate } },
      data: { userId: null },
    });

    logger.info("Anonymized audit logs older than 1 year");
  }).start();
}

async function deleteUserData(userId: string) {
  await prisma.$transaction([
    prisma.oAuthToken.deleteMany({ where: { user: { id: userId } } }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        email: null,
        name: null,
        deletedAt: new Date(),
      },
    }),
  ]);
}
```

### Data Subject Rights

**Right to Access (DSR):**
- User can download all personal data in structured, portable format
- Endpoint: `GET /api/gdpr/data-export`
- Returns JSON with all user data, agencies, provisioning history

**Right to Deletion (Right to be Forgotten):**
- User can request permanent deletion of all data
- Endpoint: `POST /api/gdpr/delete-account`
- Requires password confirmation
- Cascades to dependent data (tokens, sessions, logs)
- Logs deletion event for compliance

**Right to Rectification:**
- User can update personal information
- All changes logged in audit trail

**Right to Data Portability:**
- Data export includes machine-readable formats (JSON, CSV)
- Includes all agencies and provisioning configurations

**Implementation:**
```typescript
// pages/api/gdpr/data-export.ts
export async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = session.user.id;

  // Fetch all user data
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      agencies: true,
      provisioningJobs: true,
      auditLogs: true,
    },
  });

  // Generate export
  const exportData = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    },
    agencies: user.agencies,
    provisioningHistory: user.provisioningJobs,
    exportDate: new Date().toISOString(),
  };

  // Log data subject request
  await auditLog("GDPR_DATA_EXPORT_REQUESTED", { userId });

  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="data-export-${new Date().toISOString()}.json"`
  );
  res.write(JSON.stringify(exportData, null, 2));
  res.end();
}

// pages/api/gdpr/delete-account.ts
export async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { password } = req.body;
  const userId = session.user.id;

  // Verify password before deletion
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const passwordValid = await bcrypt.compare(password, user.passwordHash);

  if (!passwordValid) {
    return res.status(401).json({ error: "Invalid password" });
  }

  // Delete all user data
  await deleteUserData(userId);

  // Log deletion request
  await auditLog("GDPR_ACCOUNT_DELETED_REQUESTED", { userId });

  res.status(200).json({
    message: "Account deletion requested. You will be logged out.",
  });
}
```

### Data Processing Agreement (DPA)

- Document all data processing activities
- Maintain list of data processors (API providers, cloud services)
- Implement Data Processing Addendum (DPA) with vendors
- Regular data protection impact assessments (DPIA)

---

## Audit Logging

### Audit Log Schema

```prisma
model AuditLog {
  id            String   @id @default(cuid())
  userId        String?  // Nullable for anonymization after 1 year
  agencyId      String?
  action        String   // USER_LOGIN, TOKEN_ROTATED, AGENCY_CREATED, etc.
  resource      String?  // Resource being acted upon
  status        String   // SUCCESS, FAILURE, REJECTED
  details       Json     // Additional context (sanitized)
  ip            String   // IP address for security analysis
  userAgent     String?  // Browser/client information
  timestamp     DateTime @default(now())

  user          User?    @relation(fields: [userId], references: [id])
  agency        Agency?  @relation(fields: [agencyId], references: [id])

  @@index([userId, timestamp])
  @@index([agencyId, timestamp])
  @@index([action, timestamp])
}
```

### Events Logged

| Event | Details | Retention |
|-------|---------|-----------|
| `USER_SIGN_IN` | User ID, provider | 2 years |
| `USER_SIGN_OUT` | User ID | 2 years |
| `USER_MFA_ENABLED` | User ID | 2 years |
| `TOKEN_ROTATED` | Agency ID, provider, success/failure | 2 years |
| `TOKEN_REVOKED` | Agency ID, reason | 2 years |
| `AGENCY_CREATED` | Agency ID, created by user ID | 2 years |
| `AGENCY_MODIFIED` | Agency ID, modified fields, old/new values | 2 years |
| `AGENCY_DELETED` | Agency ID, deleted by user ID | 2 years |
| `PROVISIONING_STARTED` | Agency ID, provider, scope | 2 years |
| `PROVISIONING_SUCCESS` | Agency ID, provider, resources created | 2 years |
| `PROVISIONING_FAILED` | Agency ID, provider, error message (sanitized) | 2 years |
| `API_KEY_GENERATED` | User ID, scope | 2 years |
| `API_KEY_REVOKED` | User ID, API key ID | 2 years |
| `PERMISSION_GRANTED` | User ID, resource, permission | 2 years |
| `PERMISSION_REVOKED` | User ID, resource, permission | 2 years |
| `GDPR_DATA_EXPORT` | User ID | 2 years |
| `GDPR_ACCOUNT_DELETED` | User ID (before deletion) | 2 years |
| `FAILED_LOGIN_ATTEMPT` | Email/username, IP, reason | 1 year |
| `SUSPICIOUS_ACTIVITY` | User ID, description | 2 years |
| `CONFIGURATION_CHANGED` | Admin user, setting changed, old/new value | 2 years |

### Audit Logging Implementation

```typescript
// lib/auditLog.ts
export async function auditLog(
  action: string,
  details: Record<string, any>,
  options: {
    userId?: string;
    agencyId?: string;
    status?: "SUCCESS" | "FAILURE" | "REJECTED";
    ip?: string;
    userAgent?: string;
  } = {}
) {
  const sanitized = sanitizeForLogging(details);

  try {
    await prisma.auditLog.create({
      data: {
        action,
        details: sanitized,
        status: options.status || "SUCCESS",
        userId: options.userId,
        agencyId: options.agencyId,
        ip: options.ip,
        userAgent: options.userAgent,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    // Log audit failures to separate secure log
    logger.error("Failed to write audit log", {
      action,
      error: error.message,
    });
  }
}

// Middleware to capture request context
export function auditMiddleware(req: NextApiRequest, res: NextApiResponse, next) {
  // Store audit context in request for use in handlers
  req.auditContext = {
    ip: req.ip || req.headers["x-forwarded-for"],
    userAgent: req.headers["user-agent"],
    timestamp: new Date(),
  };
  next();
}
```

### Audit Log Access Control

- Only ADMIN and COMPLIANCE_OFFICER roles can view audit logs
- Filtering by date range, user, agency, action required
- Exports logged as audit events
- Real-time alerting for suspicious patterns (failed logins, mass deletions)

### Audit Log Immutability

- Audit logs are append-only (no updates or deletions)
- Implement using database triggers or application-level enforcement:
```sql
-- PostgreSQL trigger to prevent audit log modification
CREATE TRIGGER audit_log_immutable
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW
EXECUTE FUNCTION prevent_modification();

CREATE FUNCTION prevent_modification() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;
```

---

## CORS Configuration

### Allowed Origins

```typescript
// lib/cors.ts
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(",") || [
  "https://yourdomain.com",
  "https://app.yourdomain.com",
];

const ALLOWED_METHODS = ["GET", "POST", "PUT", "DELETE", "OPTIONS"];

const ALLOWED_HEADERS = [
  "Content-Type",
  "Authorization",
  "X-CSRF-Token",
  "X-Requested-With",
];

export function corsMiddleware(
  req: NextApiRequest,
  res: NextApiResponse,
  next
) {
  const origin = req.headers.origin;

  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    // CORS not needed or origin not allowed
    res.setHeader("Access-Control-Allow-Origin", "null");
    return next();
  }

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS.join(", "));
  res.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS.join(", "));
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Max-Age", "86400"); // 24 hours

  if (req.method === "OPTIONS") {
    res.status(200).end();
  } else {
    next();
  }
}
```

### CORS Policy

- Whitelist specific origins (no wildcards in production)
- Allow credentials (cookies) only from trusted origins
- Limit allowed methods to those needed (GET, POST, etc.)
- Limit allowed headers to those required
- Cache preflight requests (Access-Control-Max-Age)
- Separate API domain from web app domain for isolation

---

## Security Checklist

### Development

- [ ] All secrets in `.env.local`, never committed
- [ ] `.env.local` added to `.gitignore`
- [ ] Zod schemas validate all API inputs
- [ ] No `eval()`, `Function()`, or dynamic code execution
- [ ] No `dangerouslySetInnerHTML` in React components
- [ ] Prisma ORM used for all database queries
- [ ] OAuth tokens encrypted at rest with AES-256-GCM
- [ ] Session cookies marked httpOnly, Secure, SameSite
- [ ] CSRF tokens implemented on state-changing requests
- [ ] Rate limiting middleware on all API endpoints
- [ ] Authentication required on protected endpoints
- [ ] Authorization checks (RBAC) on sensitive operations
- [ ] Audit logging on all provisioning actions
- [ ] Error messages don't leak sensitive information
- [ ] Sensitive fields sanitized in logs
- [ ] SQL injection prevention (Prisma parameterization)
- [ ] XSS prevention (no innerHTML, sanitize user content)
- [ ] CORS whitelist configured (no wildcards)

### Build & Deployment

- [ ] Secret scanning configured in CI/CD (Husky, TruffleHog, etc.)
- [ ] Environment variables validated at build time
- [ ] Dependencies scanned for vulnerabilities (npm audit)
- [ ] Build includes security headers (HSTS, CSP, X-Frame-Options)
- [ ] CSP policy prevents inline scripts, external scripts
- [ ] TLS 1.3+ enforced (no downgrade to older versions)
- [ ] Certificate validation enabled (no self-signed in production)
- [ ] Database encryption at rest enabled
- [ ] Backup encryption configured
- [ ] Logging centralized (no logs in container/filesystem)
- [ ] No secrets in docker image or container
- [ ] Security scanning on container image (Trivy, Snyk)
- [ ] Secrets rotated before deployment

### Runtime & Operations

- [ ] HTTPS/TLS 1.3 only (HTTP upgraded to HTTPS)
- [ ] HSTS header with preload (at least 1 year, includeSubDomains)
- [ ] CSP policy enforced (not in report-only mode)
- [ ] X-Frame-Options: DENY (prevent clickjacking)
- [ ] X-Content-Type-Options: nosniff (prevent MIME sniffing)
- [ ] Referrer-Policy configured (strict-origin-when-cross-origin)
- [ ] Session timeout enforced (24 hours max)
- [ ] Stale session cookies cleared
- [ ] OAuth token rotation working (15 min before expiry)
- [ ] Token revocation working (revoke before expiry)
- [ ] Rate limiting active (responses include Retry-After header)
- [ ] Audit logs immutable (append-only database)
- [ ] Audit logs retained (2 years minimum)
- [ ] Failed login attempts logged and limited
- [ ] Suspicious activity alerts configured
- [ ] MFA enforced for admin accounts
- [ ] API keys rotated quarterly
- [ ] Database credentials in secure vault (not in code)
- [ ] Secrets not logged (automatic sanitization)

### Monitoring & Incident Response

- [ ] Security events monitored in real-time (failed logins, token rotations)
- [ ] Alerts configured for suspicious activity (brute force, unusual IP, mass deletions)
- [ ] Audit logs searchable and exportable
- [ ] Incident response plan documented
- [ ] Security contacts documented
- [ ] Breach notification procedures documented
- [ ] Compliance validation procedures documented
- [ ] Penetration testing scheduled (quarterly minimum)
- [ ] Security training completed by all developers
- [ ] Third-party security assessment completed

### Compliance

- [ ] GDPR data retention policies implemented
- [ ] GDPR data subject rights implemented (access, deletion, portability)
- [ ] Privacy policy published and current
- [ ] Cookie consent banner implemented
- [ ] Data Processing Agreement signed with processors
- [ ] Data Protection Impact Assessment (DPIA) completed
- [ ] Incident response plan complies with local regulations
- [ ] Data breach notification procedures documented

### Code Review

- [ ] No secrets committed to git
- [ ] No hardcoded credentials or API keys
- [ ] Input validation on all user inputs
- [ ] Output encoding on all output
- [ ] Proper error handling (no stack traces to user)
- [ ] Secure defaults (deny unless explicitly allowed)
- [ ] Least privilege principle applied
- [ ] Security headers present

### Testing

- [ ] Unit tests for encryption/decryption
- [ ] Unit tests for token rotation
- [ ] Unit tests for input validation
- [ ] Unit tests for rate limiting
- [ ] Unit tests for RBAC/authorization
- [ ] Integration tests for OAuth flow
- [ ] Integration tests for session management
- [ ] Security tests for XSS, SQL injection, CSRF
- [ ] Load tests verify rate limiting
- [ ] Penetration tests (third-party)

---

## Security Incident Response

### Incident Classification

- **Level 1 (Critical)**: Unauthorized access, data breach, ransomware
- **Level 2 (High)**: Token compromise, privilege escalation
- **Level 3 (Medium)**: Failed authentication attempts, rate limit abuse
- **Level 4 (Low)**: Policy violations, suspicious but benign activity

### Response Steps

1. **Detect & Alert** (Minutes)
   - Automated alerts triggered by monitoring systems
   - On-call security team notified

2. **Contain** (Minutes to Hours)
   - Revoke compromised credentials immediately
   - Isolate affected systems
   - Block suspicious IP addresses
   - Rotate encryption keys if needed

3. **Investigate** (Hours to Days)
   - Analyze audit logs for breach timeline
   - Determine extent of compromise
   - Identify affected users/agencies
   - Document findings

4. **Remediate** (Hours to Days)
   - Patch vulnerabilities
   - Reset compromised credentials
   - Deploy security updates
   - Verify systems restored

5. **Notify** (As required by law)
   - Notify affected users within 72 hours
   - Notify regulators if required
   - Notify customers/agencies
   - Publish transparency report

6. **Post-Incident** (Days to Weeks)
   - Post-incident review meeting
   - Update security documentation
   - Implement preventive measures
   - Share learnings with team

---

## References

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- NIST Cybersecurity Framework: https://www.nist.gov/cyberframework/
- CWE/SANS Top 25: https://cwe.mitre.org/top25/
- NextAuth.js Security: https://next-auth.js.org/getting-started/example
- Prisma Security: https://www.prisma.io/docs/concepts/overview/security
- Node.js Security Best Practices: https://nodejs.org/en/docs/guides/security/
- OAuth 2.0 Security Best Current Practice: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics

---

**Document Version**: 1.0
**Last Updated**: 2025-12-18
**Next Review Date**: 2026-03-18
**Owner**: Security Team
**Status**: Active
