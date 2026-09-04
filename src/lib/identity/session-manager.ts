import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { AuthMethod, UserSession } from '@prisma/client';
import { SECURITY_POLICY } from '@/lib/security/security-policy';
import { getRedisClient } from '@/lib/redis/client';

export interface CreateSessionParams {
  userId: string;
  organizationId?: string;
  authMethod?: AuthMethod;
  ip?: string;
  userAgent?: string;
}

export interface SessionVerificationResult {
  valid: boolean;
  session?: UserSession;
  error?: string;
}

export interface SafeActiveSession {
  id: string;
  authMethod: AuthMethod;
  browser: string;
  os: string;
  organizationId?: string | null;
  lastActiveAt: Date;
  createdAt: Date;
  isCurrent: boolean;
}

export class SessionManager {
  private static inMemorySessions = new Map<string, UserSession>();
  private static inMemoryRevokedTokens = new Set<string>();

  /**
   * Hashes a raw session token using SHA-256 for secure database lookup.
   */
  static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Summarizes User-Agent string into safe browser & OS info.
   */
  static parseUserAgent(ua?: string): { browser: string; os: string } {
    if (!ua) return { browser: 'Unknown Browser', os: 'Unknown OS' };

    let browser = 'Other Browser';
    if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edg')) browser = 'Microsoft Edge';

    let os = 'Other OS';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

    return { browser, os };
  }

  /**
   * Hashes IP address for privacy compliance.
   */
  static hashIp(ip?: string): string | null {
    if (!ip) return null;
    return crypto.createHash('sha256').update(ip + '_salt_recoveriq').digest('hex').substring(0, 16);
  }

  /**
   * Creates a new durable server-side session.
   */
  static async createSession(params: CreateSessionParams): Promise<{ rawToken: string; session: UserSession }> {
    const rawToken = `riq_sess_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = this.hashToken(rawToken);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + SECURITY_POLICY.session.maxAgeSeconds * 1000);
    const ipHash = this.hashIp(params.ip);
    const { browser, os } = this.parseUserAgent(params.userAgent);
    const userAgentSummary = `${browser} · ${os}`;

    let session: UserSession;

    try {
      session = await prisma.userSession.create({
        data: {
          userId: params.userId,
          tokenHash,
          ipHash,
          userAgentSummary,
          organizationId: params.organizationId || null,
          authMethod: params.authMethod || 'PASSWORD',
          lastActiveAt: now,
          expiresAt,
        },
      });
    } catch {
      // In-memory fallback
      session = {
        id: `sess_${Math.random().toString(36).substring(2, 12)}`,
        userId: params.userId,
        tokenHash,
        ipHash,
        userAgentSummary,
        organizationId: params.organizationId || null,
        authMethod: params.authMethod || 'PASSWORD',
        lastActiveAt: now,
        expiresAt,
        revokedAt: null,
        createdAt: now,
      };
      this.inMemorySessions.set(tokenHash, session);
    }

    return { rawToken, session };
  }

  /**
   * Verifies an active session token.
   */
  static async verifySession(rawToken: string): Promise<SessionVerificationResult> {
    if (!rawToken || typeof rawToken !== 'string') {
      return { valid: false, error: 'Session token required' };
    }

    const tokenHash = this.hashToken(rawToken);

    if (this.inMemoryRevokedTokens.has(tokenHash)) {
      return { valid: false, error: 'Session has been revoked' };
    }

    const redis = getRedisClient();
    if (redis && redis.isReady && redis.isReady()) {
      try {
        const isRevoked = await redis.get(`revoked_session:${tokenHash}`);
        if (isRevoked === 'true') {
          return { valid: false, error: 'Session has been revoked' };
        }
      } catch {
        // fallback
      }
    }

    let session: UserSession | null = null;

    try {
      session = await prisma.userSession.findUnique({
        where: { tokenHash },
      });
    } catch {
      session = this.inMemorySessions.get(tokenHash) || null;
    }

    if (!session) {
      return { valid: false, error: 'Session not found' };
    }

    if (session.revokedAt) {
      return { valid: false, error: 'Session has been revoked' };
    }

    const now = new Date();
    if (now > session.expiresAt) {
      return { valid: false, error: 'Session has expired' };
    }

    // Idle timeout check
    const idleSeconds = (now.getTime() - session.lastActiveAt.getTime()) / 1000;
    if (idleSeconds > SECURITY_POLICY.session.idleTimeoutSeconds) {
      return { valid: false, error: 'Session timed out due to inactivity' };
    }

    // Touch lastActiveAt
    try {
      await prisma.userSession.update({
        where: { id: session.id },
        data: { lastActiveAt: now },
      });
      session.lastActiveAt = now;
    } catch {
      session.lastActiveAt = now;
      this.inMemorySessions.set(tokenHash, session);
    }

    return { valid: true, session };
  }

  /**
   * Rotates a session token to prevent session fixation.
   */
  static async rotateSession(
    oldRawToken: string,
    overrides?: Partial<CreateSessionParams>
  ): Promise<{ rawToken: string; session: UserSession }> {
    const verified = await this.verifySession(oldRawToken);
    if (!verified.valid || !verified.session) {
      throw new Error('Cannot rotate invalid or expired session token.');
    }

    // Revoke old session token
    await this.revokeSession(verified.session.id, verified.session.userId);

    // Create fresh session with rotated token
    return await this.createSession({
      userId: verified.session.userId,
      organizationId: overrides?.organizationId !== undefined ? overrides.organizationId : verified.session.organizationId || undefined,
      authMethod: overrides?.authMethod || verified.session.authMethod,
      ip: overrides?.ip,
      userAgent: overrides?.userAgent || verified.session.userAgentSummary || undefined,
    });
  }

  /**
   * Revokes a specific session by ID.
   */
  static async revokeSession(sessionId: string, userId: string): Promise<boolean> {
    const now = new Date();

    try {
      const session = await prisma.userSession.update({
        where: { id: sessionId },
        data: { revokedAt: now },
      });

      if (session) {
        this.inMemoryRevokedTokens.add(session.tokenHash);
        const redis = getRedisClient();
        if (redis && redis.isReady && redis.isReady()) {
          try {
            await redis.set(`revoked_session:${session.tokenHash}`, 'true', { ex: SECURITY_POLICY.session.maxAgeSeconds });
          } catch {
            // ignore
          }
        }
        return true;
      }
    } catch {
      // In-memory fallback
      for (const [hash, sess] of this.inMemorySessions.entries()) {
        if (sess.id === sessionId && sess.userId === userId) {
          sess.revokedAt = now;
          this.inMemoryRevokedTokens.add(hash);
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Revokes all active sessions for a user (Sign out everywhere).
   */
  static async revokeAllSessionsForUser(userId: string, exceptSessionId?: string): Promise<number> {
    const now = new Date();
    let count = 0;

    try {
      const activeSessions = await prisma.userSession.findMany({
        where: {
          userId,
          revokedAt: null,
          ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
        },
      });

      for (const s of activeSessions) {
        this.inMemoryRevokedTokens.add(s.tokenHash);
      }

      const res = await prisma.userSession.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
        },
        data: { revokedAt: now },
      });
      count = res.count;
    } catch {
      // In-memory fallback
      for (const [hash, sess] of this.inMemorySessions.entries()) {
        if (sess.userId === userId && !sess.revokedAt && sess.id !== exceptSessionId) {
          sess.revokedAt = now;
          this.inMemoryRevokedTokens.add(hash);
          count++;
        }
      }
    }

    return count;
  }

  /**
   * Lists active sessions for a user (sanitized for settings UI).
   */
  static async listActiveSessions(userId: string, currentSessionToken?: string): Promise<SafeActiveSession[]> {
    const currentTokenHash = currentSessionToken ? this.hashToken(currentSessionToken) : null;
    let sessions: UserSession[] = [];

    try {
      sessions = await prisma.userSession.findMany({
        where: {
          userId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { lastActiveAt: 'desc' },
      });
    } catch {
      // In-memory fallback
      const now = new Date();
      sessions = Array.from(this.inMemorySessions.values()).filter(
        s => s.userId === userId && !s.revokedAt && s.expiresAt > now
      );
    }

    return sessions.map(s => {
      const [browser, os] = (s.userAgentSummary || 'Unknown Browser · Unknown OS').split(' · ');
      return {
        id: s.id,
        authMethod: s.authMethod,
        browser: browser || 'Unknown Browser',
        os: os || 'Unknown OS',
        organizationId: s.organizationId,
        lastActiveAt: s.lastActiveAt,
        createdAt: s.createdAt,
        isCurrent: currentTokenHash ? s.tokenHash === currentTokenHash : false,
      };
    });
  }
}
