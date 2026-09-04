import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, signSessionToken, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/auth/session';
import { MfaService } from '@/lib/identity/mfa-service';
import { SessionManager } from '@/lib/identity/session-manager';
import { SecurityEventService } from '@/lib/security/security-events';
import { SecurityNotificationService } from '@/lib/identity/security-notification-service';
import { generateCsrfToken } from '@/lib/security/csrf';
import { SecurityRateLimiter } from '@/lib/security/rate-limit';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
  const session = await getSessionFromRequest(req);

  if (!session) {
    return NextResponse.json({ success: false, error: 'Authentication session required' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const code = typeof body.code === 'string' ? body.code.trim() : '';

    if (!code || code.length !== 6) {
      return NextResponse.json({ success: false, error: '6-digit verification code is required.' }, { status: 400 });
    }

    // Rate limiting
    const rateLimit = await SecurityRateLimiter.checkLoginAttempt(`mfa:${ip}:${session.userId}`);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: `Too many invalid attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.` },
        { status: 429 }
      );
    }

    // Case 1: Session is pending MFA challenge during login
    if (session.pendingMfa) {
      const isValid = await MfaService.verifyUserMfaCode(session.userId, code);
      if (!isValid) {
        await SecurityEventService.recordSecurityEvent({
          merchantId: session.merchantId || 'system',
          actorId: session.userId,
          actorType: 'USER',
          action: 'AUTH_LOGIN_FAILURE' as any,
          entityType: 'AUTH',
          entityId: session.userId,
          details: { reason: 'Invalid MFA TOTP code', ip },
        });

        return NextResponse.json({ success: false, error: 'Invalid verification code.' }, { status: 401 });
      }

      // Upgrade to full durable session
      const { rawToken } = await SessionManager.createSession({
        userId: session.userId,
        organizationId: session.organizationId,
        authMethod: 'MFA_TOTP',
        ip,
        userAgent: req.headers.get('user-agent') || undefined,
      });

      const fullJwt = signSessionToken({
        ...session,
        sessionId: rawToken,
        pendingMfa: false,
        authMethod: 'MFA_TOTP',
        authenticatedAt: Date.now(),
      });

      const { token: csrfToken, cookieValue: csrfCookie } = generateCsrfToken();

      await SecurityEventService.recordSecurityEvent({
        merchantId: session.merchantId || 'system',
        actorId: session.userId,
        actorType: 'USER',
        action: 'AUTH_MFA_VERIFIED' as any,
        entityType: 'AUTH',
        entityId: session.userId,
        details: { email: session.email, authMethod: 'MFA_TOTP' },
      });

      const response = NextResponse.json({
        success: true,
        message: 'Two-factor authentication verified successfully.',
        csrfToken,
      });

      response.cookies.set(SESSION_COOKIE_NAME, fullJwt, SESSION_COOKIE_OPTIONS);
      response.cookies.set('recoveriq_csrf', csrfCookie, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 86400,
      });

      return response;
    }

    // Case 2: Finalizing enrollment proof of possession
    const enrollmentResult = await MfaService.completeEnrollment(session.userId, code);
    if (!enrollmentResult.verified) {
      return NextResponse.json({ success: false, error: enrollmentResult.error || 'Verification failed.' }, { status: 400 });
    }

    await SecurityNotificationService.sendNotification({
      userId: session.userId,
      userEmail: session.email,
      eventType: 'MFA_ENABLED',
    });

    await SecurityEventService.recordSecurityEvent({
      merchantId: session.merchantId || 'system',
      actorId: session.userId,
      actorType: 'USER',
      action: 'AUTH_MFA_VERIFIED' as any,
      entityType: 'AUTH',
      entityId: session.userId,
      details: { email: session.email, status: 'ACTIVATED' },
    });

    return NextResponse.json({
      success: true,
      message: 'Two-factor authentication has been enabled for your account.',
      recoveryCodes: enrollmentResult.recoveryCodes,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'MFA verification failed.' }, { status: 400 });
  }
}
