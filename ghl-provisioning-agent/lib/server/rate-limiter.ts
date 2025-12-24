import { NextRequest, NextResponse } from 'next/server';

/**
 * Token bucket for rate limiting
 */
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private capacity: number;
  private refillRate: number; // tokens per second

  constructor(capacity: number, refillRate: number) {
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  /**
   * Refill tokens based on time elapsed
   */
  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = timePassed * this.refillRate;

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Try to consume tokens
   * @param count - Number of tokens to consume
   * @returns true if tokens were consumed, false if insufficient tokens
   */
  consume(count: number = 1): boolean {
    this.refill();

    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }

    return false;
  }

  /**
   * Get current token count
   */
  getTokens(): number {
    this.refill();
    return this.tokens;
  }

  /**
   * Get time until next token is available (in seconds)
   */
  getRetryAfter(): number {
    this.refill();
    if (this.tokens >= 1) {
      return 0;
    }
    return Math.ceil((1 - this.tokens) / this.refillRate);
  }
}

/**
 * In-memory rate limiter store
 * In production, this should be replaced with Redis or similar
 */
class RateLimiterStore {
  private buckets: Map<string, TokenBucket>;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.buckets = new Map();
    this.startCleanup();
  }

  /**
   * Get or create token bucket for a key
   */
  getBucket(key: string, capacity: number, refillRate: number): TokenBucket {
    if (!this.buckets.has(key)) {
      this.buckets.set(key, new TokenBucket(capacity, refillRate));
    }
    return this.buckets.get(key)!;
  }

  /**
   * Start periodic cleanup of old buckets
   */
  private startCleanup(): void {
    // Clean up buckets every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, bucket] of this.buckets.entries()) {
        // Remove buckets that have been full for more than 10 minutes
        if (bucket.getTokens() === (bucket as any).capacity) {
          const lastRefill = (bucket as any).lastRefill;
          if (now - lastRefill > 10 * 60 * 1000) {
            this.buckets.delete(key);
          }
        }
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Global rate limiter store
const rateLimiterStore = new RateLimiterStore();

export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed
   */
  limit: number;

  /**
   * Time window in seconds
   */
  window: number;

  /**
   * Custom key generator function
   */
  keyGenerator?: (request: NextRequest) => string;

  /**
   * Skip rate limiting for certain conditions
   */
  skip?: (request: NextRequest) => boolean;
}

/**
 * Default configuration for different endpoints
 */
export const RATE_LIMIT_CONFIGS = {
  // General API endpoints
  api: {
    limit: 100, // 100 requests
    window: 60, // per minute
  },

  // Provisioning endpoint (lower limit due to resource intensity)
  provision: {
    limit: 10, // 10 requests
    window: 60, // per minute
  },

  // Agency-specific limits
  perAgency: {
    limit: 50, // 50 requests
    window: 60, // per minute
  },

  // IP-based limits (stricter for unauthenticated requests)
  perIP: {
    limit: 30, // 30 requests
    window: 60, // per minute
  },
};

/**
 * Rate limiting middleware
 */
export class RateLimiter {
  private config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig) {
    this.config = {
      limit: config.limit,
      window: config.window,
      keyGenerator: config.keyGenerator || this.defaultKeyGenerator,
      skip: config.skip || (() => false),
    };
  }

  /**
   * Default key generator - uses IP address
   */
  private defaultKeyGenerator(request: NextRequest): string {
    // Try to get real IP from various headers (for proxies/load balancers)
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const ip = forwardedFor?.split(',')[0] || realIP || 'unknown';

    return `ratelimit:ip:${ip}`;
  }

  /**
   * Get key for agency-based rate limiting
   */
  static agencyKeyGenerator(request: NextRequest): string {
    // Extract agency ID from request
    // This is a simplified version - in production you'd get this from auth session
    const url = new URL(request.url);
    const agencyId = url.searchParams.get('agencyId') || 'unknown';

    return `ratelimit:agency:${agencyId}`;
  }

  /**
   * Check if request should be rate limited
   * @returns NextResponse with 429 status if rate limited, null if allowed
   */
  async check(request: NextRequest): Promise<NextResponse | null> {
    // Check if we should skip rate limiting
    if (this.config.skip(request)) {
      return null;
    }

    // Generate rate limit key
    const key = this.config.keyGenerator(request);

    // Get token bucket
    const refillRate = this.config.limit / this.config.window;
    const bucket = rateLimiterStore.getBucket(key, this.config.limit, refillRate);

    // Try to consume a token
    const allowed = bucket.consume(1);

    if (!allowed) {
      // Rate limit exceeded
      const retryAfter = bucket.getRetryAfter();

      return NextResponse.json(
        {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': this.config.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(
              Date.now() + retryAfter * 1000
            ).toISOString(),
          },
        }
      );
    }

    // Request allowed - add rate limit headers to response
    return null;
  }

  /**
   * Middleware wrapper for Next.js API routes
   */
  middleware() {
    return async (
      request: NextRequest,
      handler: (request: NextRequest) => Promise<Response>
    ): Promise<Response> => {
      const rateLimitResponse = await this.check(request);

      if (rateLimitResponse) {
        return rateLimitResponse;
      }

      // Add rate limit info headers to successful response
      const response = await handler(request);
      const key = this.config.keyGenerator(request);
      const refillRate = this.config.limit / this.config.window;
      const bucket = rateLimiterStore.getBucket(key, this.config.limit, refillRate);
      const remaining = Math.floor(bucket.getTokens());

      response.headers.set('X-RateLimit-Limit', this.config.limit.toString());
      response.headers.set('X-RateLimit-Remaining', remaining.toString());

      return response;
    };
  }
}

/**
 * Create a rate limiter with predefined configuration
 */
export function createRateLimiter(
  configName: keyof typeof RATE_LIMIT_CONFIGS,
  overrides?: Partial<RateLimitConfig>
): RateLimiter {
  const baseConfig = RATE_LIMIT_CONFIGS[configName];
  return new RateLimiter({ ...baseConfig, ...overrides });
}

/**
 * Cleanup function for tests
 */
export function destroyRateLimiterStore(): void {
  rateLimiterStore.destroy();
}

export default RateLimiter;
