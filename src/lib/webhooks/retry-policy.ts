import { WebhookDeliveryStatus } from '@prisma/client';

export const WEBHOOK_RETRY_SCHEDULE_SECONDS = [
  0,     // Attempt 1: Immediate
  30,    // Attempt 2: +30 seconds
  120,   // Attempt 3: +2 minutes
  600,   // Attempt 4: +10 minutes
  1800,  // Attempt 5: +30 minutes
  7200,  // Attempt 6: +2 hours
];

export const MAX_WEBHOOK_DELIVERY_ATTEMPTS = 6;

export class WebhookRetryPolicy {
  /**
   * Returns delay in seconds for next retry, or null if attempts exhausted.
   */
  static getNextRetryDelaySeconds(attemptCount: number): number | null {
    if (attemptCount >= MAX_WEBHOOK_DELIVERY_ATTEMPTS) {
      return null;
    }
    return WEBHOOK_RETRY_SCHEDULE_SECONDS[attemptCount] ?? 7200;
  }

  /**
   * Determines if a delivery should be retried based on HTTP response status.
   * 2xx: Success (no retry)
   * 4xx (except 429): Non-retryable client configuration error
   * 429, 5xx, or network failure (null/0): Retryable
   */
  static isRetryable(statusCode: number | null): boolean {
    if (!statusCode) return true; // Network failure / timeout
    if (statusCode >= 200 && statusCode < 300) return false;
    if (statusCode === 429) return true; // Rate limited by receiver
    if (statusCode >= 400 && statusCode < 500) return false; // 400, 401, 403, 404
    return true; // 500, 502, 503, 504
  }

  /**
   * Resolves the resulting WebhookDeliveryStatus given the HTTP status and current attempt count.
   */
  static resolveStatus(
    statusCode: number | null,
    attemptCount: number
  ): WebhookDeliveryStatus {
    if (statusCode && statusCode >= 200 && statusCode < 300) {
      return WebhookDeliveryStatus.DELIVERED;
    }

    if (!this.isRetryable(statusCode)) {
      return WebhookDeliveryStatus.FAILED;
    }

    if (attemptCount >= MAX_WEBHOOK_DELIVERY_ATTEMPTS) {
      return WebhookDeliveryStatus.DEAD_LETTER;
    }

    return WebhookDeliveryStatus.RETRYING;
  }
}
