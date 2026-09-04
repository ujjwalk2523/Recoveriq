import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { MfaService } from '@/lib/identity/mfa-service';
import { StepUpService } from '@/lib/identity/step-up-service';
import { SecurityEventService } from '@/lib/security/security-events';
import { SecurityNotificationService } from '@/lib/identity/security-notification-service';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  // Require recent authentication (< 15 mins)
  StepUpService.requireRecentAuthentication({
    userId: session.userId,
    lastActiveAt: session.lastActiveAt,
    authenticatedAt: session.authenticatedAt,
  });

  try {
    const body = await req.json().catch(() => ({}));
    const code = typeof body.code === 'string' ? body.code.trim() : '';

    if (!code) {
      return NextResponse.json({ success: false, error: 'Current TOTP code is required to disable MFA.' }, { status: 400 });
    }

    const isValid = await MfaService.verifyUserMfaCode(session.userId, code);
    if (!isValid) {
      return NextResponse.json({ success: false, error: 'Invalid verification code.' }, { status: 400 });
    }

    await MfaService.disableMfa(session.userId);

    await SecurityNotificationService.sendNotification({
      userId: session.userId,
      userEmail: session.email,
      eventType: 'MFA_DISABLED',
    });

    await SecurityEventService.recordSecurityEvent({
      merchantId: session.merchantId || 'system',
      actorId: session.userId,
      actorType: 'USER',
      action: 'AUTH_MFA_DISABLED' as any,
      entityType: 'AUTH',
      entityId: session.userId,
      details: { email: session.email },
    });

    return NextResponse.json({
      success: true,
      message: 'Two-factor authentication has been disabled.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to disable MFA.' }, { status: 400 });
  }
}
