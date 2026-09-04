import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { SECURITY_POLICY } from '@/lib/security/security-policy';
import { getRedisClient } from '@/lib/redis/client';

export type UserRole = 'OWNER' | 'ADMIN' | 'ANALYST' | 'OPERATOR';

export interface AuthUserSession {
  sessionId?: string;
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  merchantId: string;
  merchantName: string;
  organizationId?: string;
  organizationName?: string;
  organizationSlug?: string;
  lastActiveAt?: number; // Epoch ms for idle timeout check
  authenticatedAt?: number; // Epoch ms of primary auth / step-up
  authMethod?: string; // PASSWORD, MFA_TOTP, SSO_OIDC, etc.
  pendingMfa?: boolean; // If true, session is restricted to MFA challenge verification only
}

export const SESSION_COOKIE_NAME = SECURITY_POLICY.session.cookieName;

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: SECURITY_POLICY.session.httpOnly,
  secure: SECURITY_POLICY.session.secure,
  sameSite: SECURITY_POLICY.session.sameSite,
  path: '/',
  maxAge: SECURITY_POLICY.session.maxAgeSeconds,
};

const JWT_SECRET = process.env.JWT_SECRET || 'recoveriq_development_secret_key_32bytes_required';

// In-memory revoked session tokens cache (with Redis synchronization where available)
export const REVOKED_SESSION_SET = new Set<string>();

/**
 * Signs a new JWT session with strict HS256 algorithm and a unique sessionId.
 */
export function signSessionToken(session: AuthUserSession): string {
  const sessionId = session.sessionId || `sess_${crypto.randomBytes(16).toString('hex')}`;
  const payload = {
    ...session,
    sessionId,
    lastActiveAt: session.lastActiveAt || Date.now(),
  };

  return jwt.sign(payload, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: `${SECURITY_POLICY.session.maxAgeSeconds}s`,
  });
}

/**
 * Rotates an existing session to a new session token to prevent session fixation.
 * Supports passing either an AuthUserSession object or an existing raw JWT string, with optional overrides.
 */
export function rotateSessionToken(
  sessionOrToken: AuthUserSession | string,
  overrides?: Partial<AuthUserSession>
): string {
  let baseSession: AuthUserSession;
  if (typeof sessionOrToken === 'string') {
    const verified = verifySessionToken(sessionOrToken);
    if (!verified) {
      throw new Error('Cannot rotate invalid or expired session token.');
    }
    const { iat: _iat, exp: _exp, ...cleanBase } = verified as any;
    baseSession = cleanBase;
  } else {
    const { iat: _iat, exp: _exp, ...cleanBase } = sessionOrToken as any;
    baseSession = cleanBase;
  }

  return signSessionToken({
    ...baseSession,
    ...overrides,
    sessionId: `sess_${crypto.randomBytes(16).toString('hex')}`,
    lastActiveAt: Date.now(),
  });
}

/**
 * Invalidates / revokes a session server-side.
 */
export async function invalidateSessionToken(token: string): Promise<void> {
  REVOKED_SESSION_SET.add(token);

  const redis = getRedisClient();
  if (redis && redis.isReady && redis.isReady()) {
    try {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await redis.set(`revoked_session:${tokenHash}`, 'true', { ex: SECURITY_POLICY.session.maxAgeSeconds });
    } catch {
      // ignore
    }
  }
}

/**
 * Checks if a session has been revoked server-side.
 */
export async function isSessionRevoked(token: string): Promise<boolean> {
  if (REVOKED_SESSION_SET.has(token)) {
    return true;
  }

  const redis = getRedisClient();
  if (redis && redis.isReady && redis.isReady()) {
    try {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const val = await redis.get(`revoked_session:${tokenHash}`);
      return val === 'true';
    } catch {
      // fallback to memory
    }
  }

  return false;
}

/**
 * Verifies and decodes a session token with strict algorithm enforcement and idle timeout check.
 */
export function verifySessionToken(token: string): AuthUserSession | null {
  if (!token || typeof token !== 'string') return null;

  if (REVOKED_SESSION_SET.has(token)) {
    return null; // Explicitly revoked
  }

  try {
    // Explicitly lock algorithm to HS256 to prevent algorithm confusion attacks
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    }) as AuthUserSession & { iat?: number; exp?: number };

    if (!decoded || !decoded.merchantId || !decoded.userId) {
      return null;
    }

    // Idle Timeout Check (if token has lastActiveAt and exceeds idle limit)
    if (decoded.lastActiveAt) {
      const idleMs = Date.now() - decoded.lastActiveAt;
      const maxIdleMs = SECURITY_POLICY.session.idleTimeoutSeconds * 1000;
      if (idleMs > maxIdleMs) {
        return null; // Timed out due to inactivity
      }
    }

    return decoded;
  } catch {
    return null;
  }
}

/**
 * Extracts authenticated merchant user session from incoming request.
 */
export async function getSessionFromRequest(req: NextRequest): Promise<AuthUserSession | null> {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Extracts session from Next.js Server Components / Server Actions.
 */
export async function getCurrentServerSession(): Promise<AuthUserSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

/**
 * Clears revoked tokens set for testing.
 */
export function clearRevokedSessionsForTesting(): void {
  REVOKED_SESSION_SET.clear();
}
