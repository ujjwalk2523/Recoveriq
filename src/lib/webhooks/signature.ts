import crypto from 'crypto';

export class WebhookSignatureService {
  /**
   * Generates a cryptographically secure random webhook secret.
   */
  static generateSecret(): string {
    return `whsec_${crypto.randomBytes(24).toString('hex')}`;
  }

  /**
   * Hashes the webhook secret using SHA-256 for secure database storage.
   */
  static hashSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret).digest('hex');
  }

  /**
   * Computes HMAC-SHA256 signature for outbound webhook payload.
   * Signed string: `${timestamp}.${rawBody}`
   */
  static computeSignature(secret: string, timestamp: number, rawBody: string): string {
    const payloadToSign = `${timestamp}.${rawBody}`;
    const hmac = crypto.createHmac('sha256', secret).update(payloadToSign).digest('hex');
    return `sha256=${hmac}`;
  }

  /**
   * Verifies an incoming webhook signature using constant-time comparison.
   */
  static verifySignature(params: {
    secret: string;
    signatureHeader: string;
    timestampHeader: string | number;
    rawBody: string;
    toleranceSeconds?: number;
  }): { isValid: boolean; error?: string } {
    const { secret, signatureHeader, timestampHeader, rawBody, toleranceSeconds = 300 } = params;

    if (!signatureHeader || !timestampHeader) {
      return { isValid: false, error: 'Missing signature or timestamp header' };
    }

    const timestampNum =
      typeof timestampHeader === 'string' ? parseInt(timestampHeader, 10) : timestampHeader;

    if (isNaN(timestampNum)) {
      return { isValid: false, error: 'Invalid timestamp format' };
    }

    // Check timestamp freshness (replay attack prevention)
    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - timestampNum) > toleranceSeconds) {
      return { isValid: false, error: 'Webhook timestamp outside tolerance window' };
    }

    const expectedSignature = this.computeSignature(secret, timestampNum, rawBody);

    const sigA = Buffer.from(signatureHeader);
    const sigB = Buffer.from(expectedSignature);

    if (sigA.length !== sigB.length) {
      return { isValid: false, error: 'Signature length mismatch' };
    }

    const isMatch = crypto.timingSafeEqual(sigA, sigB);
    if (!isMatch) {
      return { isValid: false, error: 'Signature verification failed' };
    }

    return { isValid: true };
  }
}
