import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { UserIdentityService } from './user-identity-service';
import { PasswordPolicyService } from './password-policy-service';
import { SessionManager } from './session-manager';
import { EmailDelivery } from './email-delivery-service';
import { SecurityNotificationService } from './security-notification-service';
import { SecurityEventService } from '@/lib/security/security-events';

export class AccountRecoveryService {
  private static inMemoryTokens = new Map<string, {
    id: string;
    tokenHash: string;
    type: string;
    userId?: string | null;
    email: string;
    metadata?: any;
    expiresAt: Date;
    usedAt?: Date | null;
  }>();

  /**
   * Hashes raw verification token with SHA-256
   */
  static hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Initiates password reset flow with generic non-enumerating response.
   */
  static async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    const emailNormalized = UserIdentityService.normalizeEmail(email);
    const genericResponse = {
      success: true,
      message: 'If an account exists with this email address, a password reset link has been sent.',
    };

    if (!emailNormalized) return genericResponse;

    const user = await UserIdentityService.getUserByEmail(emailNormalized);
    if (!user) {
      return genericResponse;
    }

    const rawToken = `pwreset_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

    try {
      await prisma.authVerificationToken.create({
        data: {
          tokenHash,
          type: 'PASSWORD_RESET',
          userId: user.id,
          email: user.email,
          expiresAt,
        },
      });
    } catch {
      this.inMemoryTokens.set(tokenHash, {
        id: `tok_${Math.random().toString(36).substring(2, 10)}`,
        tokenHash,
        type: 'PASSWORD_RESET',
        userId: user.id,
        email: user.email,
        expiresAt,
        usedAt: null,
      });
    }

    // Dispatch email
    const resetUrl = `https://app.recoveriq.io/auth/reset-password?token=${rawToken}`;
    await EmailDelivery.sendEmail({
      to: user.email,
      subject: 'Reset your RecoverIQ password',
      textBody: `Hello ${user.displayName || 'there'},\n\nYou requested a password reset for your RecoverIQ account.\nClick the link below to set a new password:\n\n${resetUrl}\n\nThis link will expire in 1 hour.\nIf you did not request this, please ignore this email.`,
      templateType: 'PASSWORD_RESET',
      metadata: { userId: user.id, token: rawToken },
    });

    await SecurityEventService.recordSecurityEvent({
      merchantId: 'system',
      actorId: user.id,
      actorType: 'USER',
      action: 'PASSWORD_RESET_REQUESTED' as any,
      entityType: 'AUTH',
      entityId: user.id,
      details: { email: user.emailNormalized },
    });

    return genericResponse;
  }

  /**
   * Resets password using a single-use verification token.
   */
  static async resetPassword(rawToken: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    if (!rawToken) {
      return { success: false, error: 'Password reset token is required.' };
    }

    const tokenHash = this.hashToken(rawToken);
    const now = new Date();

    let tokenRecord: any = null;
    try {
      tokenRecord = await prisma.authVerificationToken.findUnique({
        where: { tokenHash },
      });
    } catch {
      tokenRecord = this.inMemoryTokens.get(tokenHash);
    }

    if (!tokenRecord || tokenRecord.type !== 'PASSWORD_RESET') {
      return { success: false, error: 'Invalid or expired password reset link.' };
    }

    if (tokenRecord.usedAt) {
      return { success: false, error: 'This password reset link has already been used.' };
    }

    if (now > tokenRecord.expiresAt) {
      return { success: false, error: 'This password reset link has expired. Please request a new one.' };
    }

    // Validate new password policy
    const policyResult = PasswordPolicyService.validatePassword(newPassword);
    if (!policyResult.valid) {
      return { success: false, error: policyResult.errors.join(' ') };
    }

    if (!tokenRecord.userId) {
      return { success: false, error: 'User associated with token not found.' };
    }

    // Update password
    await UserIdentityService.updatePassword(tokenRecord.userId, newPassword);

    // Consume token
    try {
      await prisma.authVerificationToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: now },
      });
    } catch {
      tokenRecord.usedAt = now;
      this.inMemoryTokens.set(tokenHash, tokenRecord);
    }

    // Invalidate all existing sessions (Session rotation / sign-out everywhere)
    await SessionManager.revokeAllSessionsForUser(tokenRecord.userId);

    // Send security notification
    await SecurityNotificationService.sendNotification({
      userId: tokenRecord.userId,
      userEmail: tokenRecord.email,
      eventType: 'PASSWORD_RESET_COMPLETED',
    });

    await SecurityEventService.recordSecurityEvent({
      merchantId: 'system',
      actorId: tokenRecord.userId,
      actorType: 'USER',
      action: 'PASSWORD_RESET_COMPLETED' as any,
      entityType: 'AUTH',
      entityId: tokenRecord.userId,
      details: { email: tokenRecord.email },
    });

    return { success: true };
  }

  /**
   * Generates and dispatches email verification token.
   */
  static async sendEmailVerification(userId: string, email: string): Promise<string> {
    const rawToken = `verify_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    try {
      await prisma.authVerificationToken.create({
        data: {
          tokenHash,
          type: 'EMAIL_VERIFICATION',
          userId,
          email,
          expiresAt,
        },
      });
    } catch {
      this.inMemoryTokens.set(tokenHash, {
        id: `tok_${Math.random().toString(36).substring(2, 10)}`,
        tokenHash,
        type: 'EMAIL_VERIFICATION',
        userId,
        email,
        expiresAt,
        usedAt: null,
      });
    }

    const verifyUrl = `https://app.recoveriq.io/auth/verify-email?token=${rawToken}`;
    await EmailDelivery.sendEmail({
      to: email,
      subject: 'Verify your RecoverIQ email address',
      textBody: `Hello,\n\nPlease verify your email address for RecoverIQ by clicking the link below:\n\n${verifyUrl}\n\nThis link will expire in 24 hours.`,
      templateType: 'EMAIL_VERIFICATION',
      metadata: { userId, token: rawToken },
    });

    return rawToken;
  }

  /**
   * Verifies an email verification token and activates the account.
   */
  static async verifyEmail(rawToken: string): Promise<{ success: boolean; userId?: string; error?: string }> {
    if (!rawToken) {
      return { success: false, error: 'Verification token is required.' };
    }

    const tokenHash = this.hashToken(rawToken);
    const now = new Date();

    let tokenRecord: any = null;
    try {
      tokenRecord = await prisma.authVerificationToken.findUnique({
        where: { tokenHash },
      });
    } catch {
      tokenRecord = this.inMemoryTokens.get(tokenHash);
    }

    if (!tokenRecord || tokenRecord.type !== 'EMAIL_VERIFICATION') {
      return { success: false, error: 'Invalid or expired email verification link.' };
    }

    if (tokenRecord.usedAt) {
      return { success: false, error: 'This verification link has already been used.' };
    }

    if (now > tokenRecord.expiresAt) {
      return { success: false, error: 'This verification link has expired. Please request a new one.' };
    }

    // Mark email verified
    if (tokenRecord.userId) {
      await UserIdentityService.markEmailVerified(tokenRecord.userId);
    }

    // Consume token
    try {
      await prisma.authVerificationToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: now },
      });
    } catch {
      tokenRecord.usedAt = now;
      this.inMemoryTokens.set(tokenHash, tokenRecord);
    }

    return { success: true, userId: tokenRecord.userId || undefined };
  }

  /**
   * Requests an email change to a new address.
   */
  static async requestEmailChange(userId: string, currentEmail: string, newEmail: string): Promise<{ success: boolean; message: string }> {
    const normalizedNew = UserIdentityService.normalizeEmail(newEmail);
    if (!normalizedNew || !normalizedNew.includes('@')) {
      throw new Error('Valid new email address is required.');
    }

    const existing = await UserIdentityService.getUserByEmail(normalizedNew);
    if (existing) {
      throw new Error('An account with this email address already exists.');
    }

    const rawToken = `emailchg_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

    try {
      await prisma.authVerificationToken.create({
        data: {
          tokenHash,
          type: 'EMAIL_CHANGE',
          userId,
          email: normalizedNew,
          metadata: { currentEmail, newEmail: normalizedNew },
          expiresAt,
        },
      });
    } catch {
      this.inMemoryTokens.set(tokenHash, {
        id: `tok_${Math.random().toString(36).substring(2, 10)}`,
        tokenHash,
        type: 'EMAIL_CHANGE',
        userId,
        email: normalizedNew,
        metadata: { currentEmail, newEmail: normalizedNew },
        expiresAt,
        usedAt: null,
      });
    }

    const verifyUrl = `https://app.recoveriq.io/auth/verify-email-change?token=${rawToken}`;
    await EmailDelivery.sendEmail({
      to: normalizedNew,
      subject: 'Confirm your new email address for RecoverIQ',
      textBody: `Hello,\n\nPlease confirm changing your RecoverIQ account email to ${normalizedNew} by clicking the link below:\n\n${verifyUrl}\n\nThis link will expire in 2 hours.`,
      templateType: 'EMAIL_CHANGE',
      metadata: { userId, newEmail: normalizedNew },
    });

    return { success: true, message: `Verification link sent to ${normalizedNew}.` };
  }

  /**
   * Commits an email change after token verification.
   */
  static async verifyEmailChange(rawToken: string): Promise<{ success: boolean; newEmail?: string; error?: string }> {
    const tokenHash = this.hashToken(rawToken);
    const now = new Date();

    let tokenRecord: any = null;
    try {
      tokenRecord = await prisma.authVerificationToken.findUnique({
        where: { tokenHash },
      });
    } catch {
      tokenRecord = this.inMemoryTokens.get(tokenHash);
    }

    if (!tokenRecord || tokenRecord.type !== 'EMAIL_CHANGE' || tokenRecord.usedAt || now > tokenRecord.expiresAt) {
      return { success: false, error: 'Invalid or expired email change token.' };
    }

    const newEmail = tokenRecord.email;
    const userId = tokenRecord.userId;

    if (!userId) {
      return { success: false, error: 'User not found.' };
    }

    // Update canonical user
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          email: newEmail,
          emailNormalized: UserIdentityService.normalizeEmail(newEmail),
          emailVerifiedAt: now,
        },
      });
    } catch {
      // In-memory fallback
      const user = await UserIdentityService.getUserById(userId);
      if (user) {
        user.email = newEmail;
        user.emailNormalized = UserIdentityService.normalizeEmail(newEmail);
        user.emailVerifiedAt = now;
      }
    }

    // Consume token
    try {
      await prisma.authVerificationToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: now },
      });
    } catch {
      tokenRecord.usedAt = now;
    }

    await SecurityNotificationService.sendNotification({
      userId,
      userEmail: newEmail,
      eventType: 'EMAIL_CHANGED',
    });

    return { success: true, newEmail };
  }
}
