import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { ApplicationError } from '@/lib/errors/application-error';

export interface RecentAuthSessionContext {
  userId: string;
  authenticatedAt?: number;
  lastActiveAt?: number;
}

export class StepUpService {
  private static inMemoryTokens = new Map<string, { userId: string; purpose: string; expiresAt: Date }>();
  public static readonly DEFAULT_MAX_RECENT_AUTH_SECONDS = 900; // 15 minutes

  /**
   * Checks if an authentication event was recent.
   */
  static isRecentAuthentication(
    authTimestampMs?: number,
    maxAgeSeconds: number = this.DEFAULT_MAX_RECENT_AUTH_SECONDS
  ): boolean {
    if (!authTimestampMs) return false;
    const elapsedSeconds = (Date.now() - authTimestampMs) / 1000;
    return elapsedSeconds >= 0 && elapsedSeconds <= maxAgeSeconds;
  }

  /**
   * Enforces recent authentication context for sensitive operations.
   */
  static requireRecentAuthentication(
    session: RecentAuthSessionContext,
    maxAgeSeconds: number = this.DEFAULT_MAX_RECENT_AUTH_SECONDS
  ): void {
    const timestamp = session.authenticatedAt || session.lastActiveAt;
    if (!this.isRecentAuthentication(timestamp, maxAgeSeconds)) {
      throw new ApplicationError({
        code: 'STEP_UP_AUTHENTICATION_REQUIRED',
        message: 'This sensitive action requires recent authentication (within the last 15 minutes). Please verify your identity.',
        statusCode: 403,
        safeMessage: 'Please confirm your password or MFA code to proceed with this sensitive action.',
      });
    }
  }

  /**
   * Issues a short-lived single-use step-up verification token.
   */
  static async issueStepUpToken(userId: string, purpose: string, ttlSeconds: number = 300): Promise<string> {
    const rawToken = `stepup_${crypto.randomBytes(24).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    try {
      await prisma.authVerificationToken.create({
        data: {
          tokenHash,
          type: 'STEP_UP',
          userId,
          email: '',
          metadata: { purpose },
          expiresAt,
        },
      });
    } catch {
      this.inMemoryTokens.set(tokenHash, { userId, purpose, expiresAt });
    }

    return rawToken;
  }

  /**
   * Verifies and consumes a step-up token.
   */
  static async verifyAndConsumeStepUpToken(rawToken: string, userId: string, purpose: string): Promise<boolean> {
    if (!rawToken) return false;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = new Date();

    try {
      const record = await prisma.authVerificationToken.findUnique({
        where: { tokenHash },
      });

      if (!record || record.usedAt || record.expiresAt < now) {
        return false;
      }

      if (record.userId !== userId) {
        return false;
      }

      const meta = record.metadata as any;
      if (meta?.purpose !== purpose) {
        return false;
      }

      // Consume token
      await prisma.authVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: now },
      });

      return true;
    } catch {
      const mem = this.inMemoryTokens.get(tokenHash);
      if (!mem || mem.expiresAt < now || mem.userId !== userId || mem.purpose !== purpose) {
        return false;
      }
      this.inMemoryTokens.delete(tokenHash);
      return true;
    }
  }
}
