/**
 * RecoverIQ — Master Security Policy & Configuration
 *
 * Defines centralized security thresholds, session lifetimes, rate limits,
 * allowed origins, and replay windows across environments.
 */

export interface SecurityPolicyConfig {
  session: {
    maxAgeSeconds: number; // Absolute session expiration
    idleTimeoutSeconds: number; // Inactivity timeout
    cookieName: string;
    sameSite: 'lax' | 'strict' | 'none';
    secure: boolean;
    httpOnly: boolean;
  };
  rateLimits: {
    loginMaxAttempts: number;
    loginWindowSeconds: number;
    apiDefaultPerMinute: number;
    webhookMaxPerMinute: number;
  };
  csrf: {
    enabled: boolean;
    headerName: string;
    cookieName: string;
  };
  webhooks: {
    replayWindowSeconds: number; // Max allowed webhook timestamp drift
  };
  ssrf: {
    allowedProtocols: string[];
    blockedHostnames: string[];
  };
  origins: {
    allowedOrigins: string[];
  };
}

export const SECURITY_POLICY: SecurityPolicyConfig = {
  session: {
    maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days absolute limit
    idleTimeoutSeconds: 60 * 60 * 4, // 4 hours inactivity timeout
    cookieName: 'rcvq_session',
    sameSite: 'lax',
    secure: process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production',
    httpOnly: true,
  },
  rateLimits: {
    loginMaxAttempts: 5,
    loginWindowSeconds: 60 * 15, // 15-minute lockout window for 5 consecutive failures
    apiDefaultPerMinute: 120,
    webhookMaxPerMinute: 600,
  },
  csrf: {
    enabled: true,
    headerName: 'x-csrf-token',
    cookieName: 'rcvq_csrf',
  },
  webhooks: {
    replayWindowSeconds: 300, // 5 minutes max age
  },
  ssrf: {
    allowedProtocols: ['https:'],
    blockedHostnames: [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      '169.254.169.254', // AWS/GCP instance metadata service
      'metadata.google.internal',
    ],
  },
  origins: {
    allowedOrigins: [
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'https://api.razorpay.com',
      'https://checkout.razorpay.com',
    ],
  },
};
