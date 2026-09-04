import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { SECURITY_POLICY } from './security-policy';
import { ApplicationError } from '@/lib/errors/application-error';

export class CsrfValidationError extends ApplicationError {
  constructor(message = 'CSRF validation failed: missing or invalid CSRF token.') {
    super({
      code: 'CSRF_VALIDATION_FAILED',
      message,
      statusCode: 403,
      safeMessage: 'Invalid security token. Please refresh and try again.',
    });
  }
}

export class InvalidOriginError extends ApplicationError {
  constructor(origin: string) {
    super({
      code: 'INVALID_ORIGIN',
      message: `Untrusted origin '${origin}' rejected.`,
      statusCode: 403,
      safeMessage: 'Request rejected from untrusted source.',
    });
  }
}

/**
 * Generates a cryptographically strong CSRF token and its HMAC signature.
 */
export function generateCsrfToken(secret = process.env.SESSION_SECRET || 'recoveriq_csrf_secret_32bytes_min'): {
  token: string;
  cookieValue: string;
} {
  const randomBytes = crypto.randomBytes(24).toString('hex');
  const timestamp = Date.now();
  const raw = `${randomBytes}.${timestamp}`;
  const hmac = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const token = `${raw}.${hmac}`;

  return {
    token,
    cookieValue: token,
  };
}

/**
 * Validates the Origin / Referer header for browser requests.
 */
export function validateOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const host = req.headers.get('host') || req.nextUrl?.host || '';

  // If no origin or referer present (e.g. non-browser direct call), rely on other auth
  if (!origin && !referer) {
    return true;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (host ? `http://${host}` : '');
  let allowedHost = '';
  try {
    if (appUrl) allowedHost = new URL(appUrl).host;
  } catch {
    allowedHost = host || '';
  }

  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (originHost === host || (allowedHost && originHost === allowedHost)) {
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  if (referer) {
    try {
      const refererHost = new URL(referer).host;
      if (refererHost === host || (allowedHost && refererHost === allowedHost)) {
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  return true;
}

/**
 * Validates CSRF token for browser state-changing requests.
 * Exempts:
 * - Safe HTTP methods (GET, HEAD, OPTIONS)
 * - API Key routes (/api/v1/...)
 * - Webhook routes (/api/webhooks/...)
 */
export function verifyCsrf(req: NextRequest): void {
  const method = req.method.toUpperCase();
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  if (!isStateChanging) {
    return; // Safe method
  }

  const path = req.nextUrl.pathname;
  if (path.startsWith('/api/v1/') || path.startsWith('/api/webhooks/')) {
    return; // Exempt external API and webhook routes
  }

  // If request uses API key, exempt from CSRF
  const authHeader = req.headers.get('authorization') || '';
  const apiKeyHeader = req.headers.get('x-api-key') || '';
  if (apiKeyHeader.startsWith('rk_') || authHeader.startsWith('Bearer rk_')) {
    return;
  }

  // 1. Origin / Referer Validation
  if (!validateOrigin(req)) {
    throw new InvalidOriginError(req.headers.get('origin') || req.headers.get('referer') || 'unknown');
  }

  // 2. Double-Submit Token Validation
  const headerToken = req.headers.get(SECURITY_POLICY.csrf.headerName);
  const cookieToken = req.cookies.get(SECURITY_POLICY.csrf.cookieName)?.value;

  if (!headerToken && !cookieToken) {
    // If not using browser cookie auth, check session cookie
    const hasSessionCookie = req.cookies.has(SECURITY_POLICY.session.cookieName);
    if (!hasSessionCookie) {
      return; // Anonymous request
    }
    throw new CsrfValidationError('Missing CSRF token in request headers.');
  }

  if (!headerToken || !cookieToken) {
    throw new CsrfValidationError('CSRF token mismatch between header and cookie.');
  }

  // Timing safe comparison
  const bufHeader = Buffer.from(headerToken, 'utf8');
  const bufCookie = Buffer.from(cookieToken, 'utf8');

  if (bufHeader.length !== bufCookie.length || !crypto.timingSafeEqual(bufHeader, bufCookie)) {
    throw new CsrfValidationError('CSRF token does not match cookie value.');
  }
}
