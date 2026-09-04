import { AppEnv, getEnvConfig, EnvConfig } from './env';

export function getRuntimeEnvironment(): AppEnv {
  return getEnvConfig().APP_ENV;
}

export function isDevelopment(): boolean {
  return getRuntimeEnvironment() === 'development';
}

export function isTest(): boolean {
  return getRuntimeEnvironment() === 'test';
}

export function isStaging(): boolean {
  return getRuntimeEnvironment() === 'staging';
}

export function isProduction(): boolean {
  return getRuntimeEnvironment() === 'production';
}

export function assertEnvironment(expected: AppEnv | AppEnv[]): void {
  const current = getRuntimeEnvironment();
  const allowed = Array.isArray(expected) ? expected : [expected];

  if (!allowed.includes(current)) {
    throw new Error(
      `[EnvironmentMismatchError] Action prohibited in '${current}' environment. Expected one of: ${allowed.join(
        ', '
      )}`
    );
  }
}

/**
 * Validates cross-environment credential safety rules.
 * Prevents test credentials in production and live credentials in test/staging/dev.
 */
export function validateEnvironmentSafety(config?: Partial<EnvConfig>): { safe: boolean; reason?: string } {
  const active = { ...getEnvConfig(), ...(config || {}) };
  const { APP_ENV, RAZORPAY_KEY_ID, RAZORPAY_WEBHOOK_SECRET } = active;

  if (APP_ENV === 'production') {
    // 1. Guard against Razorpay test key in production
    if (RAZORPAY_KEY_ID.startsWith('rzp_test_')) {
      const msg = `[EnvironmentSafetyError] Production environment detected with Razorpay Test Mode Key ('${RAZORPAY_KEY_ID.slice(
        0,
        12
      )}...'). Production requires Live credentials.`;
      throw new Error(msg);
    }

    // 2. Guard against test webhook secret in production
    if (RAZORPAY_WEBHOOK_SECRET.includes('test') || RAZORPAY_WEBHOOK_SECRET.startsWith('whsec_test')) {
      const msg = `[EnvironmentSafetyError] Production environment detected with test webhook secret. Production requires authoritative Live webhook secrets.`;
      throw new Error(msg);
    }
  } else {
    // 3. Guard against live credentials in dev/test/staging
    if (RAZORPAY_KEY_ID.startsWith('rzp_live_')) {
      const msg = `[EnvironmentSafetyError] Non-production environment '${APP_ENV}' detected with Live Razorpay credentials ('${RAZORPAY_KEY_ID.slice(
        0,
        12
      )}...'). Non-production execution must use Test Mode credentials.`;
      throw new Error(msg);
    }
  }

  return { safe: true };
}

export function isPaymentExecutionEnabled(): boolean {
  return getEnvConfig().PAYMENT_EXECUTION_ENABLED;
}

export function isLivePaymentTestingAllowed(): boolean {
  return getEnvConfig().ALLOW_LIVE_PAYMENT_TESTS;
}
