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
    const recoveryCode = typeof body.recoveryCode === 'string' ? body.recoveryCode.trim() : '';

    if (!recoveryCode) {
      return NextResponse.json({ success: false, error: 'Recovery code is required.' }, { status: 400 });
    }

    // Rate limiting recovery code attempts
    const rateLimit = await SecurityRateLimiter.checkLoginAttempt(`mfarec:${ip}:${session.userId}`);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: `Too many invalid attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.` },
        { status: 429 }
      );
    }

    const isValid = await MfaService.verifyAndConsumeRecoveryCode(session.userId, recoveryCode);
    if (!isValid) {
      await SecurityEventService.recordSecurityEvent({
        merchantId: session.merchantId || 'system',
        actorId: session.userId,
        actorType: 'USER',
        action: 'AUTH_LOGIN_FAILURE' as any,
        entityType: 'AUTH',
        entityId: session.userId,
        details: { reason: 'Invalid or already used recovery code', ip },
      });

      return NextResponse.json({ success: false, error: 'Invalid or already consumed recovery code.' }, { status: 400 });
    }

    // Upgrade session
    const { rawToken } = await SessionManager.createSession({
      userId: session.userId,
      organizationId: session.organizationId,
      authMethod: 'MFA_RECOVERY_CODE',
      ip,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    const fullJwt = signSessionToken({
      ...session,
      sessionId: rawToken,
      pendingMfa: false,
      authMethod: 'MFA_RECOVERY_CODE',
      authenticatedAt: Date.now(),
    });

    const { token: csrfToken, cookieValue: csrfCookie } = generateCsrfToken();

    await SecurityNotificationService.sendNotification({
      userId: session.userId,
      userEmail: session.email,
      eventType: 'MFA_RECOVERY_CODE_USED',
    });

    await SecurityEventService.recordSecurityEvent({
      merchantId: session.merchantId || 'system',
      actorId: session.userId,
      actorType: 'USER',
      action: 'AUTH_MFA_RECOVERY_USED' as any,
      entityType: 'AUTH',
      entityId: session.userId,
      details: { email: session.email },
    });

    const response = NextResponse.json({
      success: true,
      message: 'Recovery code accepted. Session established. Please regenerate your recovery codes or reconfigure your authenticator app.',
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
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Recovery code verification failed.' }, { status: 400 });
  }
}
