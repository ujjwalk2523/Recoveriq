import { getEnvConfig } from './env';
import { APP_VERSION, SERVICE_NAME } from './version';

export interface RuntimeConfig {
  application: {
    service: string;
    version: string;
    environment: string;
    url: string;
  };
  database: {
    configured: boolean;
  };
  redis: {
    configured: boolean;
    enabled: boolean;
    connectionTimeoutMs: number;
    commandTimeoutMs: number;
    keyPrefix: string;
  };
  razorpay: {
    provider: string;
    environment: 'TEST' | 'LIVE';
    configured: boolean;
    isTestMode: boolean;
    executionEnabled: boolean;
    keyPrefix: string;
  };
  ml: {
    configured: boolean;
    serviceUrl?: string;
  };
  workers: {
    enabled: boolean;
    concurrency: number;
    leaseTtlMs: number;
    heartbeatIntervalMs: number;
    pollIntervalMs: number;
  };
  observability: {
    logLevel: string;
    webhookTimeoutMs: number;
  };
}

export function getRuntimeConfig(): RuntimeConfig {
  const env = getEnvConfig();

  return {
    application: {
      service: SERVICE_NAME,
      version: APP_VERSION,
      environment: env.APP_ENV,
      url: env.NEXT_PUBLIC_APP_URL,
    },
    database: {
      configured: !!env.DATABASE_URL && env.DATABASE_URL.length > 0,
    },
    redis: {
      configured: !!env.REDIS_URL && env.REDIS_URL.length > 0,
      enabled: env.WORKER_ENABLED && !!env.REDIS_URL,
      connectionTimeoutMs: env.REDIS_CONNECTION_TIMEOUT_MS,
      commandTimeoutMs: env.REDIS_COMMAND_TIMEOUT_MS,
      keyPrefix: `recoveriq:${env.APP_ENV}:`,
    },
    razorpay: {
      provider: 'razorpay',
      environment: env.APP_ENV === 'production' ? 'LIVE' : 'TEST',
      configured: !!env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_ID.length > 0,
      isTestMode: env.RAZORPAY_KEY_ID.startsWith('rzp_test_'),
      executionEnabled: env.PAYMENT_EXECUTION_ENABLED,
      keyPrefix: env.RAZORPAY_KEY_ID.slice(0, 8),
    },
    ml: {
      configured: !!env.ML_SERVICE_URL && env.ML_SERVICE_URL.length > 0,
      serviceUrl: env.ML_SERVICE_URL,
    },
    workers: {
      enabled: env.WORKER_ENABLED,
      concurrency: env.WORKER_CONCURRENCY,
      leaseTtlMs: env.WORKER_LEASE_TTL_MS,
      heartbeatIntervalMs: env.WORKER_HEARTBEAT_INTERVAL_MS,
      pollIntervalMs: env.WORKER_POLL_INTERVAL_MS,
    },
    observability: {
      logLevel: env.LOG_LEVEL,
      webhookTimeoutMs: env.WEBHOOK_TIMEOUT_MS,
    },
  };
}
