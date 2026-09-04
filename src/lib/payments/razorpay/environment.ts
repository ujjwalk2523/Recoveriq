import { AppEnv, getEnvConfig } from '@/lib/config/env';
import { getRuntimeEnvironment } from '@/lib/config/environment';
import { RazorpayEnvironment } from './types';
import { EntitlementService } from '@/lib/billing/entitlement-service';
import { PaymentProviderAccountService } from './provider-account-service';

/**
 * Resolves the corresponding Razorpay provider environment from the Application environment.
 * Invariant:
 *   development -> TEST
 *   test        -> TEST
 *   staging     -> TEST
 *   production  -> LIVE
 */
export function resolveRazorpayEnvironment(appEnv: AppEnv = getRuntimeEnvironment()): RazorpayEnvironment {
  switch (appEnv) {
    case 'production':
      return 'LIVE';
    case 'staging':
    case 'test':
    case 'development':
    default:
      return 'TEST';
  }
}

/**
 * Validates whether a target Razorpay environment is permitted in the active application environment.
 */
export function validateRazorpayEnvironmentCompatibility(
  appEnv: AppEnv,
  rzpEnv: RazorpayEnvironment
): { valid: boolean; reason?: string } {
  if (appEnv === 'production') {
    if (rzpEnv !== 'LIVE') {
      return {
        valid: false,
        reason: `Production environment requires LIVE Razorpay environment. Received '${rzpEnv}'.`,
      };
    }
    return { valid: true };
  }

  // Staging, Test, Development
  if (rzpEnv === 'LIVE') {
    return {
      valid: false,
      reason: `Non-production environment '${appEnv}' cannot execute against LIVE Razorpay environment.`,
    };
  }

  return { valid: true };
}

export interface AssertPaymentExecutionAllowedParams {
  merchantId: string;
  transactionId?: string;
  actionType: string;
  providerEnvironment?: RazorpayEnvironment;
  isTestRun?: boolean;
}

/**
 * Comprehensive production safety gate.
 * Fails closed before any outbound mutation to Razorpay.
 */
export async function assertPaymentExecutionAllowed(
  params: AssertPaymentExecutionAllowedParams
): Promise<{ allowed: boolean; reason?: string }> {
  const config = getEnvConfig();
  const appEnv = config.APP_ENV;
  const targetRzpEnv = params.providerEnvironment || resolveRazorpayEnvironment(appEnv);

  // 1. Production Kill Switch Check
  if (!config.PAYMENT_EXECUTION_ENABLED) {
    throw new Error(
      `[PaymentExecutionHalted] Payment execution is currently disabled by operational kill switch (PAYMENT_EXECUTION_ENABLED=false).`
    );
  }

  // 2. Automated Test Suite Live Guard
  if (targetRzpEnv === 'LIVE' && !config.ALLOW_LIVE_PAYMENT_TESTS && (appEnv !== 'production' || params.isTestRun)) {
    throw new Error(
      `[LivePaymentSafetyViolation] Live payment execution blocked in automated test / non-production environment. ALLOW_LIVE_PAYMENT_TESTS is false.`
    );
  }

  // 3. Environment Compatibility Check
  const compat = validateRazorpayEnvironmentCompatibility(appEnv, targetRzpEnv);
  if (!compat.valid) {
    throw new Error(`[EnvironmentMismatchError] ${compat.reason}`);
  }

  // 4. Multi-Tenant Provider Account Status Check
  const providerAccount = await PaymentProviderAccountService.getAccount(params.merchantId, targetRzpEnv);
  if (providerAccount && providerAccount.status !== 'ACTIVE') {
    throw new Error(
      `[ProviderAccountInactive] Provider account for merchant ${params.merchantId} is ${providerAccount.status}. Payment execution prohibited.`
    );
  }

  // 5. Multi-Tenant Server-Side Entitlement Check
  const entitlement = await EntitlementService.canExecuteRecovery(params.merchantId);
  if (!entitlement.allowed) {
    throw new Error(
      `[EntitlementDenied] Merchant ${params.merchantId} is not entitled to execute recovery: ${entitlement.reason}`
    );
  }

  return { allowed: true };
}
