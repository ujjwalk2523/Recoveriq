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

  // Require recent authentication
  StepUpService.requireRecentAuthentication({
    userId: session.userId,
    lastActiveAt: session.lastActiveAt,
    authenticatedAt: session.authenticatedAt,
  });

  try {
    const newCodes = await MfaService.regenerateRecoveryCodes(session.userId);

    await SecurityEventService.recordSecurityEvent({
      merchantId: session.merchantId || 'system',
      actorId: session.userId,
      actorType: 'USER',
      action: 'AUTH_MFA_ENROLLED' as any,
      entityType: 'AUTH',
      entityId: session.userId,
      details: { email: session.email, action: 'RECOVERY_CODES_REGENERATED' },
    });

    return NextResponse.json({
      success: true,
      recoveryCodes: newCodes,
      message: 'New recovery codes generated. All previous recovery codes are now invalid.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to regenerate recovery codes.' }, { status: 400 });
  }
}
