import { ApplicationError } from '@/lib/errors/application-error';
import { getRedisClient } from '@/lib/redis/client';
import { SECURITY_POLICY } from './security-policy';

export class RateLimitExceededError extends ApplicationError {
  public retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, message = 'Rate limit exceeded. Please try again later.') {
    super({
      code: 'RATE_LIMIT_EXCEEDED',
      message,
      statusCode: 429,
      safeMessage: 'Too many requests. Please slow down.',
    });
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

interface InMemoryRateLimitBucket {
  count: number;
  resetAtMs: number;
}

export const IN_MEMORY_RATE_LIMIT_STORE = new Map<string, InMemoryRateLimitBucket>();

export interface RateLimitStatus {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  retryAfterSeconds?: number;
}

export class SecurityRateLimiter {
  /**
   * Evaluates request rate against specified limit and window.
   */
  static async checkRateLimit(params: {
    key: string;
    limit: number;
    windowSeconds: number;
  }): Promise<RateLimitStatus> {
    const { key, limit, windowSeconds } = params;
    const now = Date.now();
    const redis = getRedisClient();

    if (redis && redis.isReady && redis.isReady()) {
      try {
        const redisKey = `ratelimit:${key}:${Math.floor(now / (windowSeconds * 1000))}`;
        const valStr = await redis.get(redisKey);
        const current = (valStr ? parseInt(valStr, 10) : 0) + 1;
        await redis.set(redisKey, current.toString(), { ex: windowSeconds + 1 });
        const remaining = Math.max(0, limit - current);
        const resetSeconds = Math.ceil((now + windowSeconds * 1000) / 1000);

        if (current > limit) {
          return {
            allowed: false,
            limit,
            remaining: 0,
            resetSeconds,
            retryAfterSeconds: windowSeconds,
          };
        }

        return {
          allowed: true,
          limit,
          remaining,
          resetSeconds,
        };
      } catch {
        // Fallback to in-memory on redis error
      }
    }

    // In-memory sliding window bucket fallback
    const bucketKey = `${key}:${Math.floor(now / (windowSeconds * 1000))}`;
    let bucket = IN_MEMORY_RATE_LIMIT_STORE.get(bucketKey);

    if (!bucket || now > bucket.resetAtMs) {
      bucket = {
        count: 0,
        resetAtMs: now + windowSeconds * 1000,
      };
    }

    bucket.count += 1;
    IN_MEMORY_RATE_LIMIT_STORE.set(bucketKey, bucket);

    const remaining = Math.max(0, limit - bucket.count);
    const resetSeconds = Math.ceil(bucket.resetAtMs / 1000);
    const allowed = bucket.count <= limit;

    if (!allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAtMs - now) / 1000));
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetSeconds,
        retryAfterSeconds,
      };
    }

    return {
      allowed: true,
      limit,
      remaining,
      resetSeconds,
    };
  }

  /**
   * Asserts rate limit or throws RateLimitExceededError.
   */
  static async assertRateLimit(params: {
    key: string;
    limit: number;
    windowSeconds: number;
  }): Promise<RateLimitStatus> {
    const status = await this.checkRateLimit(params);
    if (!status.allowed) {
      throw new RateLimitExceededError(status.retryAfterSeconds || 60);
    }
    return status;
  }

  static async assertAllowed(params: {
    key: string;
    limit: number;
    windowSeconds: number;
  }): Promise<RateLimitStatus> {
    return this.assertRateLimit(params);
  }

  /**
   * Dedicated rate limiter for authentication/login attempts.
   */
  static async checkLoginAttempt(identifier: string): Promise<RateLimitStatus> {
    return this.checkRateLimit({
      key: `login:${identifier}`,
      limit: SECURITY_POLICY.rateLimits.loginMaxAttempts,
      windowSeconds: SECURITY_POLICY.rateLimits.loginWindowSeconds,
    });
  }

  /**
   * Clears memory buckets (for test isolation).
   */
  static clearForTesting(): void {
    IN_MEMORY_RATE_LIMIT_STORE.clear();
  }
}
