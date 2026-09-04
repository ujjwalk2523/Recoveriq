import { logger } from '@/lib/observability/logger';
import { getEnvConfig } from '@/lib/config/env';
import { resolveRazorpayEnvironment, validateRazorpayEnvironmentCompatibility } from './environment';
import { PaymentProviderAccountService } from './provider-account-service';
import { normalizeRazorpayError } from './errors';
import {
  RazorpayEnvironment,
  RazorpayOrderInput,
  RazorpayOrderResponse,
  RazorpayPaymentResponse,
  RazorpayPaymentLinkInput,
  RazorpayPaymentLinkResponse,
} from './types';

export interface RazorpayClientOptions {
  keyId: string;
  keySecret: string;
  environment: RazorpayEnvironment;
  merchantId?: string;
}

export class RazorpayClient {
  public readonly keyId: string;
  private readonly keySecret: string;
  public readonly environment: RazorpayEnvironment;
  public readonly merchantId?: string;
  private baseUrl = 'https://api.razorpay.com/v1';

  constructor(options: RazorpayClientOptions) {
    this.keyId = options.keyId;
    this.keySecret = options.keySecret;
    this.environment = options.environment;
    this.merchantId = options.merchantId;

    logger.info('[RazorpayClient] Initialized Razorpay client', {
      environment: this.environment,
      merchantId: this.merchantId || 'system_default',
      keyPrefix: this.keyId.slice(0, 8),
      provider: 'RAZORPAY',
    });
  }

  private get authHeader(): string {
    return 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
  }

  private isMockKey(): boolean {
    return (
      !this.keyId ||
      this.keyId.includes('placeholder') ||
      this.keyId.includes('demo') ||
      this.keyId.includes('mock') ||
      this.keyId.includes('test') ||
      this.keySecret.includes('placeholder') ||
      this.keySecret.includes('demo') ||
      this.keySecret.includes('mock') ||
      this.keySecret.includes('test') ||
      this.keySecret.includes('verified')
    );
  }

  /**
   * Create an Order in Razorpay
   */
  async createOrder(input: RazorpayOrderInput): Promise<RazorpayOrderResponse> {
    if (this.isMockKey()) {
      return {
        id: `order_${Math.random().toString(36).substring(2, 12)}`,
        entity: 'order',
        amount: input.amount,
        amount_paid: 0,
        amount_due: input.amount,
        currency: input.currency || 'INR',
        receipt: input.receipt,
        status: 'created',
        created_at: Math.floor(Date.now() / 1000),
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/orders`, {
        method: 'POST',
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: input.amount,
          currency: input.currency || 'INR',
          receipt: input.receipt,
          notes: input.notes,
        }),
      });

      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        throw normalizeRazorpayError(errPayload, res.status);
      }

      return await res.json();
    } catch (err: any) {
      if (err.name === 'PaymentProviderError') throw err;
      throw normalizeRazorpayError(err);
    }
  }

  /**
   * Fetch an Order by ID
   */
  async fetchOrder(orderId: string): Promise<RazorpayOrderResponse> {
    if (this.isMockKey()) {
      return {
        id: orderId,
        entity: 'order',
        amount: 250000,
        amount_paid: 250000,
        amount_due: 0,
        currency: 'INR',
        status: 'paid',
        created_at: Math.floor(Date.now() / 1000) - 3600,
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/orders/${orderId}`, {
        headers: { Authorization: this.authHeader },
      });

      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        throw normalizeRazorpayError(errPayload, res.status);
      }

      return await res.json();
    } catch (err: any) {
      if (err.name === 'PaymentProviderError') throw err;
      throw normalizeRazorpayError(err);
    }
  }

  /**
   * Fetch a Payment by ID
   */
  async fetchPayment(paymentId: string): Promise<RazorpayPaymentResponse> {
    if (this.isMockKey()) {
      return {
        id: paymentId,
        entity: 'payment',
        amount: 185000,
        currency: 'INR',
        status: 'captured',
        method: 'upi',
        created_at: Math.floor(Date.now() / 1000),
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
        headers: { Authorization: this.authHeader },
      });

      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        throw normalizeRazorpayError(errPayload, res.status);
      }

      return await res.json();
    } catch (err: any) {
      if (err.name === 'PaymentProviderError') throw err;
      throw normalizeRazorpayError(err);
    }
  }

  /**
   * Create a Payment Link
   */
  async createPaymentLink(input: RazorpayPaymentLinkInput): Promise<RazorpayPaymentLinkResponse> {
    if (this.isMockKey()) {
      const plinkId = `plink_${Math.random().toString(36).substring(2, 12)}`;
      return {
        id: plinkId,
        entity: 'payment_link',
        short_url: `https://rzp.io/i/${plinkId.slice(-6)}`,
        status: 'created',
        amount: input.amount,
        amount_paid: 0,
        currency: input.currency || 'INR',
        description: input.description,
        reference_id: input.reference_id,
        created_at: Math.floor(Date.now() / 1000),
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/payment_links`, {
        method: 'POST',
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        throw normalizeRazorpayError(errPayload, res.status);
      }

      return await res.json();
    } catch (err: any) {
      if (err.name === 'PaymentProviderError') throw err;
      throw normalizeRazorpayError(err);
    }
  }
}

/**
 * Centralized Razorpay Client Factory.
 * Resolves credentials securely, validates environment compatibility, and returns initialized client.
 */
export async function getRazorpayClient(params?: {
  merchantId?: string;
  environment?: RazorpayEnvironment;
}): Promise<RazorpayClient> {
  const appEnv = getEnvConfig().APP_ENV;
  const targetRzpEnv = params?.environment || resolveRazorpayEnvironment(appEnv);
  const merchantId = params?.merchantId || 'platform_default';

  // Validate environment compatibility
  const compat = validateRazorpayEnvironmentCompatibility(appEnv, targetRzpEnv);
  if (!compat.valid) {
    throw new Error(`[EnvironmentMismatchError] ${compat.reason}`);
  }

  // Resolve merchant or platform credentials
  const creds = await PaymentProviderAccountService.resolveCredentials(merchantId, targetRzpEnv);

  return new RazorpayClient({
    keyId: creds.keyId,
    keySecret: creds.keySecret,
    environment: targetRzpEnv,
    merchantId,
  });
}
