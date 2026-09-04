import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { MfaService } from '@/lib/identity/mfa-service';
import { StepUpService } from '@/lib/identity/step-up-service';
import { SecurityEventService } from '@/lib/security/security-events';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  // Require recent authentication to initiate enrollment
  StepUpService.requireRecentAuthentication({
    userId: session.userId,
    lastActiveAt: session.lastActiveAt,
    authenticatedAt: session.authenticatedAt,
  });

  try {
    const enrollment = await MfaService.initiateEnrollment(session.userId, session.email);

    await SecurityEventService.recordSecurityEvent({
      merchantId: session.merchantId || 'system',
      actorId: session.userId,
      actorType: 'USER',
      action: 'AUTH_MFA_ENROLLED' as any,
      entityType: 'AUTH',
      entityId: session.userId,
      details: { email: session.email, status: 'INITIATED' },
    });

    return NextResponse.json({
      success: true,
      secret: enrollment.secret,
      otpauthUri: enrollment.otpauthUri,
      message: 'Scan the QR code or enter the secret in your authenticator app, then verify with a 6-digit code.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to initiate MFA enrollment.' }, { status: 400 });
  }
}
