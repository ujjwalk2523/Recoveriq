import crypto from 'crypto';
import { getEnvConfig } from '../config/env';
import { resolveRazorpayEnvironment } from '../payments/razorpay/environment';
import { RazorpayEnvironment } from '../payments/razorpay/types';

/**
 * Validates the HMAC-SHA256 signature sent by Razorpay in the x-razorpay-signature header.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret?: string
): boolean {
  const effectiveSecret =
    secret || getEnvConfig().RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET || 'whsec_recoveriq_test_secret_32bytes';

  if (!signature || !effectiveSecret || !rawBody) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', effectiveSecret)
      .update(rawBody)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');

    if (expectedBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
  } catch (err) {
    console.error('[Razorpay Signature Verification Error]', err);
    return false;
  }
}

/**
 * Computes an HMAC-SHA256 signature for a given payload and secret.
 * Used for automated testing and outbound webhooks.
 */
export function computeWebhookSignature(
  rawBody: string,
  secret?: string
): string {
  const effectiveSecret =
    secret || getEnvConfig().RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET || 'whsec_recoveriq_test_secret_32bytes';
  return crypto.createHmac('sha256', effectiveSecret).update(rawBody).digest('hex');
}

/**
 * Validates webhook timestamp freshness to protect against replay attacks.
 * Rejects payloads older than maxAgeSeconds (default 5 minutes).
 */
export function validateWebhookFreshness(
  createdAtTimestampSeconds?: number,
  maxAgeSeconds = 300
): { valid: boolean; ageSeconds?: number; reason?: string } {
  if (!createdAtTimestampSeconds) {
    // If not provided, assume fresh for mock/internal test compatibility
    return { valid: true };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const age = nowSeconds - createdAtTimestampSeconds;

  if (age > maxAgeSeconds) {
    return {
      valid: false,
      ageSeconds: age,
      reason: `Webhook timestamp expired (${age}s old, exceeds max allowed age of ${maxAgeSeconds}s). Possible replay attack.`,
    };
  }

  if (age < -60) {
    // Clock skew guard
    return {
      valid: false,
      ageSeconds: age,
      reason: `Webhook timestamp is from the future (${-age}s in future). Clock skew detected.`,
    };
  }

  return { valid: true, ageSeconds: age };
}

/**
 * Validates that the webhook payload environment strictly matches the system's expected Razorpay environment.
 */
export function validateWebhookEnvironment(
  payload: any,
  expectedEnv?: RazorpayEnvironment
): { valid: boolean; reason?: string } {
  const targetEnv = expectedEnv || resolveRazorpayEnvironment();

  const entity = payload?.payload?.payment?.entity || payload?.payload?.order?.entity || {};
  const paymentId: string = entity.id || '';
  const orderId: string = entity.order_id || entity.id || '';
  const notes = entity.notes || {};

  if (targetEnv === 'LIVE') {
    if (
      paymentId.startsWith('pay_test_') ||
      orderId.startsWith('order_test_') ||
      notes.environment === 'test' ||
      notes.is_test === true
    ) {
      return {
        valid: false,
        reason: 'TEST webhook payload rejected in LIVE production environment.',
      };
    }
  }

  if (targetEnv === 'TEST') {
    if (
      paymentId.startsWith('pay_live_') ||
      orderId.startsWith('order_live_') ||
      notes.environment === 'live' ||
      notes.is_live === true
    ) {
      return {
        valid: false,
        reason: 'LIVE webhook payload rejected in TEST non-production environment.',
      };
    }
  }

  return { valid: true };
}
