import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { StepUpService } from '@/lib/identity/step-up-service';
import { AccountRecoveryService } from '@/lib/identity/account-recovery-service';
import { sanitizePlainText } from '@/lib/security/input-security';
import { SecurityEventService } from '@/lib/security/security-events';

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
    const rawNewEmail = typeof body.newEmail === 'string' ? sanitizePlainText(body.newEmail, 120) : '';

    if (!rawNewEmail) {
      return NextResponse.json({ success: false, error: 'New email address is required.' }, { status: 400 });
    }

    const result = await AccountRecoveryService.requestEmailChange(session.userId, session.email, rawNewEmail);

    await SecurityEventService.recordSecurityEvent({
      merchantId: session.merchantId || 'system',
      actorId: session.userId,
      actorType: 'USER',
      action: 'AUTH_EMAIL_CHANGE_REQUESTED' as any,
      entityType: 'AUTH',
      entityId: session.userId,
      details: { currentEmail: session.email, requestedEmail: rawNewEmail },
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to request email change.' }, { status: 400 });
  }
}
