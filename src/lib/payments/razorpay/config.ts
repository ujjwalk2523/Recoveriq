import { getEnvConfig } from '@/lib/config/env';
import { resolveRazorpayEnvironment } from './environment';
import { RazorpayCredentials, RazorpayEnvironment } from './types';

export interface RazorpaySystemConfig {
  environment: RazorpayEnvironment;
  merchantCredentials: RazorpayCredentials;
  billingCredentials: {
    secretKey: string;
    webhookSecret: string;
  };
  executionEnabled: boolean;
  allowLivePaymentTests: boolean;
}

/**
 * Returns centralized, server-only Razorpay configuration.
 * Strictly isolates Merchant payment recovery credentials from RecoverIQ SaaS billing credentials.
 */
export function getRazorpayConfig(): RazorpaySystemConfig {
  const env = getEnvConfig();
  const rzpEnv = resolveRazorpayEnvironment(env.APP_ENV);

  // Merchant recovery payment credentials
  const merchantCredentials: RazorpayCredentials = {
    keyId: env.RAZORPAY_KEY_ID,
    keySecret: env.RAZORPAY_KEY_SECRET,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
    environment: rzpEnv,
  };

  // RecoverIQ SaaS billing credentials (completely separate from merchant recovery)
  const billingCredentials = {
    secretKey: process.env.RAZORPAY_BILLING_SECRET_KEY || 'rzp_test_billing_secret',
    webhookSecret: process.env.RAZORPAY_BILLING_WEBHOOK_SECRET || 'rzp_test_billing_whsec',
  };

  return {
    environment: rzpEnv,
    merchantCredentials,
    billingCredentials,
    executionEnabled: env.PAYMENT_EXECUTION_ENABLED,
    allowLivePaymentTests: env.ALLOW_LIVE_PAYMENT_TESTS,
  };
}
