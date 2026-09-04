export type AppEnv = 'development' | 'test' | 'staging' | 'production';

export interface EnvConfig {
  APP_ENV: AppEnv;
  NEXT_PUBLIC_APP_URL: string;
  DATABASE_URL: string;
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
  RAZORPAY_WEBHOOK_SECRET: string;
  RAZORPAY_TEST_KEY_ID?: string;
  RAZORPAY_TEST_KEY_SECRET?: string;
  RAZORPAY_TEST_WEBHOOK_SECRET?: string;
  RAZORPAY_LIVE_KEY_ID?: string;
  RAZORPAY_LIVE_KEY_SECRET?: string;
  RAZORPAY_LIVE_WEBHOOK_SECRET?: string;
  PAYMENT_EXECUTION_ENABLED: boolean;
  ALLOW_LIVE_PAYMENT_TESTS: boolean;
  ML_SERVICE_URL?: string;
  REDIS_URL?: string;
  REDIS_CONNECTION_TIMEOUT_MS: number;
  REDIS_COMMAND_TIMEOUT_MS: number;
  LOG_LEVEL: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  SESSION_SECRET: string;
  API_ENCRYPTION_KEY: string;
  WEBHOOK_TIMEOUT_MS: number;
  WORKER_ENABLED: boolean;
  WORKER_CONCURRENCY: number;
  WORKER_LEASE_TTL_MS: number;
  WORKER_HEARTBEAT_INTERVAL_MS: number;
  WORKER_POLL_INTERVAL_MS: number;
}

const VALID_APP_ENVS: AppEnv[] = ['development', 'test', 'staging', 'production'];

/**
 * Validates and normalizes raw process.env inputs into a validated EnvConfig.
 * In production, fails fast if critical secrets or valid formats are absent.
 */
export function parseAndValidateEnv(env: Record<string, string | undefined> = process.env): EnvConfig {
  const rawAppEnv = env.APP_ENV || env.NODE_ENV || 'development';
  const appEnv = rawAppEnv.toLowerCase() as AppEnv;

  if (!VALID_APP_ENVS.includes(appEnv)) {
    throw new Error(
      `[ConfigError] Invalid APP_ENV '${rawAppEnv}'. Allowed values: ${VALID_APP_ENVS.join(', ')}`
    );
  }

  const isProd = appEnv === 'production';
  const workerEnabled = env.WORKER_ENABLED === 'true';

  // Resolve effective Razorpay credentials
  const effectiveKeyId = isProd
    ? env.RAZORPAY_LIVE_KEY_ID || env.RAZORPAY_KEY_ID || ''
    : env.RAZORPAY_TEST_KEY_ID || env.RAZORPAY_KEY_ID || 'rzp_test_placeholder_key';

  const effectiveKeySecret = isProd
    ? env.RAZORPAY_LIVE_KEY_SECRET || env.RAZORPAY_KEY_SECRET || ''
    : env.RAZORPAY_TEST_KEY_SECRET || env.RAZORPAY_KEY_SECRET || 'rzp_test_placeholder_secret';

  const effectiveWebhookSecret = isProd
    ? env.RAZORPAY_LIVE_WEBHOOK_SECRET || env.RAZORPAY_WEBHOOK_SECRET || ''
    : env.RAZORPAY_TEST_WEBHOOK_SECRET || env.RAZORPAY_WEBHOOK_SECRET || 'whsec_recoveriq_test_secret_32bytes';

  // 1. Production Strict Secret Validation
  if (isProd) {
    const mandatoryKeys = [
      'DATABASE_URL',
      'SESSION_SECRET',
      'API_ENCRYPTION_KEY',
    ];

    if (!effectiveKeyId) mandatoryKeys.push('RAZORPAY_KEY_ID');
    if (!effectiveKeySecret) mandatoryKeys.push('RAZORPAY_KEY_SECRET');
    if (!effectiveWebhookSecret) mandatoryKeys.push('RAZORPAY_WEBHOOK_SECRET');

    if (workerEnabled) {
      mandatoryKeys.push('REDIS_URL');
    }

    const missingKeys = mandatoryKeys.filter((k) => !env[k] || env[k]!.trim() === '');
    if (missingKeys.length > 0) {
      throw new Error(
        `[ConfigError] Production startup aborted. Mandatory environment secrets missing: ${missingKeys.join(', ')}`
      );
    }

    if (effectiveKeyId.startsWith('rzp_test_')) {
      throw new Error(
        `[ConfigError] Production startup aborted. Razorpay Test Mode key detected in production: '${effectiveKeyId.slice(0, 12)}...'`
      );
    }

    if (effectiveWebhookSecret.includes('test') || effectiveWebhookSecret.startsWith('whsec_test')) {
      throw new Error(
        `[ConfigError] Production startup aborted. Razorpay test webhook secret detected in production.`
      );
    }
  } else {
    // Non-production strict safety: Live keys strictly prohibited in dev/test/staging
    if (effectiveKeyId.startsWith('rzp_live_')) {
      throw new Error(
        `[ConfigError] Non-production environment '${appEnv}' startup aborted. Live Razorpay credentials detected: '${effectiveKeyId.slice(0, 12)}...'`
      );
    }
  }

  const logLevel = (env.LOG_LEVEL || (isProd ? 'INFO' : 'DEBUG')).toUpperCase() as
    | 'DEBUG'
    | 'INFO'
    | 'WARN'
    | 'ERROR';

  const webhookTimeout = env.WEBHOOK_TIMEOUT_MS ? parseInt(env.WEBHOOK_TIMEOUT_MS, 10) : 5000;
  const redisConnTimeout = env.REDIS_CONNECTION_TIMEOUT_MS ? parseInt(env.REDIS_CONNECTION_TIMEOUT_MS, 10) : 3000;
  const redisCmdTimeout = env.REDIS_COMMAND_TIMEOUT_MS ? parseInt(env.REDIS_COMMAND_TIMEOUT_MS, 10) : 5000;
  const workerConcurrency = env.WORKER_CONCURRENCY ? parseInt(env.WORKER_CONCURRENCY, 10) : 5;
  const workerLeaseTtl = env.WORKER_LEASE_TTL_MS ? parseInt(env.WORKER_LEASE_TTL_MS, 10) : 30000;
  const workerHeartbeat = env.WORKER_HEARTBEAT_INTERVAL_MS ? parseInt(env.WORKER_HEARTBEAT_INTERVAL_MS, 10) : 10000;
  const workerPoll = env.WORKER_POLL_INTERVAL_MS ? parseInt(env.WORKER_POLL_INTERVAL_MS, 10) : 1000;

  const paymentExecutionEnabled = env.PAYMENT_EXECUTION_ENABLED !== 'false';
  const allowLivePaymentTests = env.ALLOW_LIVE_PAYMENT_TESTS === 'true';

  const config: EnvConfig = {
    APP_ENV: appEnv,
    NEXT_PUBLIC_APP_URL: env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    DATABASE_URL: env.DATABASE_URL || 'postgresql://recoveriq:recoveriq@localhost:5432/recoveriq_dev',
    RAZORPAY_KEY_ID: effectiveKeyId,
    RAZORPAY_KEY_SECRET: effectiveKeySecret,
    RAZORPAY_WEBHOOK_SECRET: effectiveWebhookSecret,
    RAZORPAY_TEST_KEY_ID: env.RAZORPAY_TEST_KEY_ID,
    RAZORPAY_TEST_KEY_SECRET: env.RAZORPAY_TEST_KEY_SECRET,
    RAZORPAY_TEST_WEBHOOK_SECRET: env.RAZORPAY_TEST_WEBHOOK_SECRET,
    RAZORPAY_LIVE_KEY_ID: env.RAZORPAY_LIVE_KEY_ID,
    RAZORPAY_LIVE_KEY_SECRET: env.RAZORPAY_LIVE_KEY_SECRET,
    RAZORPAY_LIVE_WEBHOOK_SECRET: env.RAZORPAY_LIVE_WEBHOOK_SECRET,
    PAYMENT_EXECUTION_ENABLED: paymentExecutionEnabled,
    ALLOW_LIVE_PAYMENT_TESTS: allowLivePaymentTests,
    ML_SERVICE_URL: env.ML_SERVICE_URL,
    REDIS_URL: env.REDIS_URL,
    REDIS_CONNECTION_TIMEOUT_MS: isNaN(redisConnTimeout) ? 3000 : redisConnTimeout,
    REDIS_COMMAND_TIMEOUT_MS: isNaN(redisCmdTimeout) ? 5000 : redisCmdTimeout,
    LOG_LEVEL: ['DEBUG', 'INFO', 'WARN', 'ERROR'].includes(logLevel) ? logLevel : 'INFO',
    SESSION_SECRET: env.SESSION_SECRET || 'dev_session_secret_change_in_production_32_bytes_min',
    API_ENCRYPTION_KEY: env.API_ENCRYPTION_KEY || 'dev_encryption_key_32_bytes_safe_demo',
    WEBHOOK_TIMEOUT_MS: isNaN(webhookTimeout) ? 5000 : webhookTimeout,
    WORKER_ENABLED: workerEnabled,
    WORKER_CONCURRENCY: isNaN(workerConcurrency) ? 5 : workerConcurrency,
    WORKER_LEASE_TTL_MS: isNaN(workerLeaseTtl) ? 30000 : workerLeaseTtl,
    WORKER_HEARTBEAT_INTERVAL_MS: isNaN(workerHeartbeat) ? 10000 : workerHeartbeat,
    WORKER_POLL_INTERVAL_MS: isNaN(workerPoll) ? 1000 : workerPoll,
  };

  return config;
}

let cachedEnvConfig: EnvConfig | null = null;

export function getEnvConfig(): EnvConfig {
  if (!cachedEnvConfig) {
    cachedEnvConfig = parseAndValidateEnv();
  }
  return cachedEnvConfig;
}

export function resetEnvConfigForTesting(customEnv?: Record<string, string | undefined>): EnvConfig {
  cachedEnvConfig = customEnv ? parseAndValidateEnv(customEnv) : null;
  return cachedEnvConfig || parseAndValidateEnv();
}
