import type { NextAuthConfig } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import prisma from './db';
import { encryptToken } from './encryption';

// GHL OAuth configuration
const GHL_OAUTH_AUTHORIZE_URL =
  process.env.GHL_OAUTH_AUTHORIZE_URL ||
  'https://marketplace.gohighlevel.com/oauth/chooselocation';
const GHL_OAUTH_TOKEN_URL =
  process.env.GHL_OAUTH_TOKEN_URL || 'https://services.leadconnectorhq.com/oauth/token';
const GHL_CLIENT_ID = process.env.GHL_CLIENT_ID || '';
const GHL_CLIENT_SECRET = process.env.GHL_CLIENT_SECRET || '';

// Define custom GHL OAuth provider type
interface GHLProfile {
  id: string;
  companyId: string;
  locationId?: string;
  email?: string;
  name?: string;
}

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [
    {
      id: 'ghl',
      name: 'GoHighLevel',
      type: 'oauth' as const,
      authorization: {
        url: GHL_OAUTH_AUTHORIZE_URL,
        params: {
          scope: 'conversations/message.readonly conversations/message.write',
          response_type: 'code',
        },
      },
      token: {
        url: GHL_OAUTH_TOKEN_URL,
        async request({ params, provider }: any) {
          // Custom token exchange
          const response = await fetch(provider.token.url as string, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              code: params.code as string,
              client_id: GHL_CLIENT_ID,
              client_secret: GHL_CLIENT_SECRET,
              redirect_uri: params.redirect_uri as string,
            }),
          });

          const tokens = await response.json();

          if (!response.ok) {
            throw new Error(
              `Token exchange failed: ${tokens.error || 'Unknown error'}`
            );
          }

          return {
            tokens: {
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
              expires_at: Math.floor(Date.now() / 1000) + (tokens.expires_in || 3600),
              token_type: tokens.token_type || 'Bearer',
              scope: tokens.scope || '',
            },
          };
        },
      },
      userinfo: {
        async request({ tokens }: any) {
          // Fetch user info from GHL API
          const response = await fetch(
            'https://services.leadconnectorhq.com/oauth/userinfo',
            {
              headers: {
                Authorization: `Bearer ${tokens.access_token}`,
              },
            }
          );

          if (!response.ok) {
            throw new Error('Failed to fetch user info');
          }

          return await response.json();
        },
      },
      profile(profile: GHLProfile) {
        return {
          id: profile.companyId || profile.id,
          email: profile.email || `${profile.id}@ghl.local`,
          name: profile.name || 'GHL User',
          ghlCompanyId: profile.companyId,
          ghlLocationId: profile.locationId,
        };
      },
      clientId: GHL_CLIENT_ID,
      clientSecret: GHL_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: false,
    },
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 60 * 60, // Refresh session every hour
  },
  callbacks: {
    async jwt({ token, account, profile, user, trigger }) {
      // First sign-in: store encrypted OAuth tokens
      if (account && account.provider === 'ghl') {
        try {
          // Encrypt and store tokens
          const accessTokenEncrypted = encryptToken(account.access_token as string);
          const refreshTokenEncrypted = encryptToken(account.refresh_token as string);

          // Create or update agency record
          const ghlCompanyId = (profile as any)?.companyId || user.id;

          const agency = await prisma.agency.upsert({
            where: { ghlAgencyId: ghlCompanyId },
            update: {
              oauthAccessTokenEncrypted: accessTokenEncrypted,
              oauthRefreshTokenEncrypted: refreshTokenEncrypted,
              tokenExpiresAt: new Date((account.expires_at as number) * 1000),
              updatedAt: new Date(),
            },
            create: {
              name: (profile as any)?.name || 'GHL Agency',
              ghlAgencyId: ghlCompanyId,
              oauthAccessTokenEncrypted: accessTokenEncrypted,
              oauthRefreshTokenEncrypted: refreshTokenEncrypted,
              tokenExpiresAt: new Date((account.expires_at as number) * 1000),
            },
          });

          token.agencyId = agency.id;
          token.ghlCompanyId = ghlCompanyId;
        } catch (error) {
          console.error('Failed to store OAuth tokens:', error);
          throw error;
        }
      }

      // Add user info to token
      if (user) {
        token.userId = user.id;
      }

      return token;
    },

    async session({ session, token }) {
      // Add custom fields to session
      if (token) {
        session.user.id = token.userId as string;
        session.user.agencyId = token.agencyId as string;
        session.user.ghlCompanyId = token.ghlCompanyId as string;
      }

      return session;
    },

    async redirect({ url, baseUrl }) {
      // Validate redirect URLs to prevent open redirect vulnerability
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }

      // Allow callback to same origin
      if (new URL(url).origin === baseUrl) {
        return url;
      }

      return baseUrl;
    },
  },
  events: {
    async signIn({ user, account, profile }) {
      console.log('Sign in event:', {
        userId: user.id,
        provider: account?.provider,
        timestamp: new Date().toISOString(),
      });
    },

    async signOut({ token }: any) {
      console.log('Sign out event:', {
        userId: token?.userId,
        timestamp: new Date().toISOString(),
      });
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  debug: process.env.NODE_ENV === 'development',
};

// Extend NextAuth types
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      agencyId: string;
      ghlCompanyId: string;
    };
  }

  interface User {
    ghlCompanyId?: string;
    ghlLocationId?: string;
  }

  interface JWT {
    userId?: string;
    agencyId?: string;
    ghlCompanyId?: string;
  }
}
