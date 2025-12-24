import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter, createRateLimiter, RATE_LIMIT_CONFIGS } from '../rate-limiter';
import { NextRequest } from 'next/server';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Token Bucket', () => {
    it('should allow requests within rate limit', async () => {
      const limiter = new RateLimiter({
        limit: 10,
        window: 60, // 10 requests per minute
      });

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      // First 10 requests should be allowed
      for (let i = 0; i < 10; i++) {
        const response = await limiter.check(request);
        expect(response).toBeNull(); // Null means allowed
      }
    });

    it('should block requests exceeding rate limit', async () => {
      const limiter = new RateLimiter({
        limit: 5,
        window: 60,
      });

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      // First 5 requests allowed
      for (let i = 0; i < 5; i++) {
        const response = await limiter.check(request);
        expect(response).toBeNull();
      }

      // 6th request should be blocked
      const blockedResponse = await limiter.check(request);
      expect(blockedResponse).not.toBeNull();
      expect(blockedResponse?.status).toBe(429);

      const data = await blockedResponse?.json();
      expect(data.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should refill tokens over time', async () => {
      const limiter = new RateLimiter({
        limit: 5,
        window: 10, // 5 requests per 10 seconds = 0.5 req/sec
      });

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      // Consume all 5 tokens
      for (let i = 0; i < 5; i++) {
        await limiter.check(request);
      }

      // Should be blocked
      let response = await limiter.check(request);
      expect(response?.status).toBe(429);

      // Advance time by 2 seconds (should add 1 token)
      vi.advanceTimersByTime(2000);

      // Should be allowed (1 token refilled)
      response = await limiter.check(request);
      expect(response).toBeNull();

      // Should be blocked again
      response = await limiter.check(request);
      expect(response?.status).toBe(429);
    });

    it('should not exceed capacity when refilling', async () => {
      const limiter = new RateLimiter({
        limit: 5,
        window: 10,
      });

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      // Consume 1 token
      await limiter.check(request);

      // Advance time way past capacity refill
      vi.advanceTimersByTime(60000); // 1 minute

      // Should still only have capacity amount (5 tokens)
      for (let i = 0; i < 5; i++) {
        const response = await limiter.check(request);
        expect(response).toBeNull();
      }

      // 6th should be blocked
      const response = await limiter.check(request);
      expect(response?.status).toBe(429);
    });
  });

  describe('Custom Key Generators', () => {
    it('should use custom key generator', async () => {
      const customKeyGen = (req: NextRequest) => {
        const userId = req.headers.get('x-user-id') || 'anonymous';
        return `custom:${userId}`;
      };

      const limiter = new RateLimiter({
        limit: 3,
        window: 60,
        keyGenerator: customKeyGen,
      });

      const request1 = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-user-id': 'user1' },
      });

      const request2 = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-user-id': 'user2' },
      });

      // User1 consumes 3 tokens
      for (let i = 0; i < 3; i++) {
        await limiter.check(request1);
      }

      // User1 should be blocked
      let response = await limiter.check(request1);
      expect(response?.status).toBe(429);

      // User2 should still be allowed (different key)
      response = await limiter.check(request2);
      expect(response).toBeNull();
    });

    it('should use agency-based key generator', async () => {
      const limiter = new RateLimiter({
        limit: 5,
        window: 60,
        keyGenerator: RateLimiter.agencyKeyGenerator,
      });

      const request1 = new NextRequest(
        'http://localhost:3000/api/test?agencyId=agency1'
      );
      const request2 = new NextRequest(
        'http://localhost:3000/api/test?agencyId=agency2'
      );

      // Agency1 consumes all tokens
      for (let i = 0; i < 5; i++) {
        await limiter.check(request1);
      }

      // Agency1 blocked
      let response = await limiter.check(request1);
      expect(response?.status).toBe(429);

      // Agency2 still allowed
      response = await limiter.check(request2);
      expect(response).toBeNull();
    });
  });

  describe('Skip Conditions', () => {
    it('should skip rate limiting based on condition', async () => {
      const limiter = new RateLimiter({
        limit: 1,
        window: 60,
        skip: (req) => {
          // Skip if has admin header
          return req.headers.get('x-admin') === 'true';
        },
      });

      const adminRequest = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-admin': 'true' },
      });

      // Should never be rate limited
      for (let i = 0; i < 10; i++) {
        const response = await limiter.check(adminRequest);
        expect(response).toBeNull();
      }
    });

    it('should apply rate limiting when skip condition is false', async () => {
      const limiter = new RateLimiter({
        limit: 2,
        window: 60,
        skip: (req) => req.headers.get('x-admin') === 'true',
      });

      const normalRequest = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-admin': 'false' },
      });

      // First 2 allowed
      await limiter.check(normalRequest);
      await limiter.check(normalRequest);

      // 3rd blocked
      const response = await limiter.check(normalRequest);
      expect(response?.status).toBe(429);
    });
  });

  describe('Rate Limit Headers', () => {
    it('should return retry-after header when rate limited', async () => {
      const limiter = new RateLimiter({
        limit: 1,
        window: 10, // 1 req per 10 seconds
      });

      const request = new NextRequest('http://localhost:3000/api/test');

      // Consume the token
      await limiter.check(request);

      // Get rate limited
      const response = await limiter.check(request);
      expect(response?.headers.get('Retry-After')).toBeTruthy();
      expect(response?.headers.get('X-RateLimit-Limit')).toBe('1');
      expect(response?.headers.get('X-RateLimit-Remaining')).toBe('0');
    });
  });

  describe('Predefined Configurations', () => {
    it('should create rate limiter with API config', async () => {
      const limiter = createRateLimiter('api');
      const request = new NextRequest('http://localhost:3000/api/test');

      // Should allow 100 requests (API config limit)
      for (let i = 0; i < 100; i++) {
        const response = await limiter.check(request);
        expect(response).toBeNull();
      }

      // 101st should be blocked
      const response = await limiter.check(request);
      expect(response?.status).toBe(429);
    });

    it('should create rate limiter with provision config', async () => {
      const limiter = createRateLimiter('provision');
      const request = new NextRequest('http://localhost:3000/api/provision');

      // Should allow 10 requests (provision config limit)
      for (let i = 0; i < 10; i++) {
        const response = await limiter.check(request);
        expect(response).toBeNull();
      }

      // 11th should be blocked
      const response = await limiter.check(request);
      expect(response?.status).toBe(429);
    });

    it('should allow config overrides', async () => {
      const limiter = createRateLimiter('api', {
        limit: 5, // Override default 100
      });
      const request = new NextRequest('http://localhost:3000/api/test');

      // Should allow 5 requests (overridden limit)
      for (let i = 0; i < 5; i++) {
        const response = await limiter.check(request);
        expect(response).toBeNull();
      }

      // 6th should be blocked
      const response = await limiter.check(request);
      expect(response?.status).toBe(429);
    });
  });

  describe('IP-based Rate Limiting', () => {
    it('should extract IP from x-forwarded-for header', async () => {
      const limiter = new RateLimiter({
        limit: 2,
        window: 60,
      });

      const request1 = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      const request2 = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.2' },
      });

      // IP1 consumes 2 tokens
      await limiter.check(request1);
      await limiter.check(request1);

      // IP1 should be blocked
      let response = await limiter.check(request1);
      expect(response?.status).toBe(429);

      // IP2 should still be allowed
      response = await limiter.check(request2);
      expect(response).toBeNull();
    });

    it('should handle multiple IPs in x-forwarded-for', async () => {
      const limiter = new RateLimiter({
        limit: 1,
        window: 60,
      });

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1, 172.16.0.1' },
      });

      // Should use first IP
      await limiter.check(request);

      const response = await limiter.check(request);
      expect(response?.status).toBe(429);
    });

    it('should fallback to x-real-ip if x-forwarded-for not present', async () => {
      const limiter = new RateLimiter({
        limit: 1,
        window: 60,
      });

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-real-ip': '192.168.1.100' },
      });

      await limiter.check(request);

      const response = await limiter.check(request);
      expect(response?.status).toBe(429);
    });
  });

  describe('Middleware Integration', () => {
    it('should work as middleware wrapper', async () => {
      const limiter = new RateLimiter({
        limit: 2,
        window: 60,
      });

      const handler = async (req: NextRequest) => {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      const middleware = limiter.middleware();

      const request = new NextRequest('http://localhost:3000/api/test');

      // First 2 requests should succeed
      let response = await middleware(request, handler);
      expect(response.status).toBe(200);

      response = await middleware(request, handler);
      expect(response.status).toBe(200);

      // 3rd request should be rate limited
      response = await middleware(request, handler);
      expect(response.status).toBe(429);
    });

    it('should add rate limit headers to successful responses', async () => {
      const limiter = new RateLimiter({
        limit: 10,
        window: 60,
      });

      const handler = async () => {
        return new Response('OK');
      };

      const middleware = limiter.middleware();
      const request = new NextRequest('http://localhost:3000/api/test');

      const response = await middleware(request, handler);

      expect(response.headers.get('X-RateLimit-Limit')).toBeTruthy();
      expect(response.headers.get('X-RateLimit-Remaining')).toBeTruthy();
    });
  });
});
