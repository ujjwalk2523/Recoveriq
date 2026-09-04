import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { SsoService } from '@/lib/identity/sso-service';
import { StepUpService } from '@/lib/identity/step-up-service';
import { SecurityEventService } from '@/lib/security/security-events';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const { id: identityId } = await params;
  if (!identityId) {
    return NextResponse.json({ success: false, error: 'Identity ID is required.' }, { status: 400 });
  }

  // Require recent authentication to unlink
  StepUpService.requireRecentAuthentication({
    userId: session.userId,
    lastActiveAt: session.lastActiveAt,
    authenticatedAt: session.authenticatedAt,
  });

  try {
    await SsoService.unlinkExternalIdentity(session.userId, identityId);

    await SecurityEventService.recordSecurityEvent({
      merchantId: session.merchantId || 'system',
      actorId: session.userId,
      actorType: 'USER',
      action: 'AUTH_IDENTITY_UNLINKED' as any,
      entityType: 'AUTH',
      entityId: identityId,
      details: { email: session.email, identityId },
    });

    return NextResponse.json({
      success: true,
      message: 'Account unlinked successfully.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to unlink identity.' }, { status: 400 });
  }
}
