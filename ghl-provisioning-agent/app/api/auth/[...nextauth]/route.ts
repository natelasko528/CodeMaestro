import { NextRequest, NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from '@/lib/server/auth';

const handler = NextAuth(authConfig);

export async function GET(req: NextRequest) {
  return handler(req as any) as Promise<NextResponse>;
}

export async function POST(req: NextRequest) {
  return handler(req as any) as Promise<NextResponse>;
}
