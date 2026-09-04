import { EntitlementService } from '@/lib/billing/entitlement-service';
import { ApiError, ApiErrorCode } from '../errors';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix epoch seconds
  retryAfter?: number; // seconds
}

interface WindowBucket {
  count: number;
  resetAt: number;
}

// In-memory sliding window bucket store
export const IN_MEMORY_RATE_LIMITS = new Map<string, WindowBucket>();

export class ApiRateLimitService {
  /**
   * Evaluates request rate against merchant's plan allowances.
   * Uses a 60-second sliding window.
   */
  static async checkRateLimit(
    merchantId: string,
    customWindowSeconds = 60
  ): Promise<RateLimitResult> {
    const monthlyLimit = await EntitlementService.getApiRequestLimit(merchantId);

    // Derive per-minute window quota based on plan capacity (default minimum: 120 req/min)
    const windowLimit =
      monthlyLimit === -1
        ? 10000 // Enterprise: generous ceiling
        : Math.max(120, Math.round((monthlyLimit / (30 * 24 * 60)) * 10)); // 10x burst multiplier

    const now = Date.now();
    const bucketKey = `${merchantId}:${Math.floor(now / (customWindowSeconds * 1000))}`;
    const resetTimeSeconds = Math.ceil((now + customWindowSeconds * 1000) / 1000);

    const bucket = IN_MEMORY_RATE_LIMITS.get(bucketKey) || { count: 0, resetAt: resetTimeSeconds };
    bucket.count += 1;
    IN_MEMORY_RATE_LIMITS.set(bucketKey, bucket);

    const remaining = Math.max(0, windowLimit - bucket.count);
    const allowed = bucket.count <= windowLimit;

    if (!allowed) {
      const retryAfter = Math.max(1, bucket.resetAt - Math.floor(now / 1000));
      return {
        allowed: false,
        limit: windowLimit,
        remaining: 0,
        reset: bucket.resetAt,
        retryAfter,
      };
    }

    return {
      allowed: true,
      limit: windowLimit,
      remaining,
      reset: bucket.resetAt,
    };
  }

  /**
   * Asserts rate limit, throwing HTTP 429 ApiError if limit exceeded.
   */
  static async assertRateLimit(merchantId: string): Promise<Record<string, string>> {
    const result = await this.checkRateLimit(merchantId);

    const headers: Record<string, string> = {
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(result.reset),
    };

    if (!result.allowed) {
      headers['Retry-After'] = String(result.retryAfter || 60);
      const err = new ApiError(
        ApiErrorCode.RATE_LIMIT_EXCEEDED,
        `Rate limit of ${result.limit} requests/minute exceeded. Please retry after ${result.retryAfter || 60} seconds.`,
        429
      );
      (err as any).headers = headers;
      throw err;
    }

    return headers;
  }

  static clearCache(): void {
    IN_MEMORY_RATE_LIMITS.clear();
  }
}
