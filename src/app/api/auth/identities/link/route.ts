import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { SsoService } from '@/lib/identity/sso-service';
import { StepUpService } from '@/lib/identity/step-up-service';
import { SecurityEventService } from '@/lib/security/security-events';
import { SecurityNotificationService } from '@/lib/identity/security-notification-service';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  // Require recent authentication to link identity
  StepUpService.requireRecentAuthentication({
    userId: session.userId,
    lastActiveAt: session.lastActiveAt,
    authenticatedAt: session.authenticatedAt,
  });

  try {
    const body = await req.json().catch(() => ({}));
    const provider = body.provider;
    const providerUserId = typeof body.providerUserId === 'string' ? body.providerUserId.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : undefined;

    if (!provider || !providerUserId) {
      return NextResponse.json(
        { success: false, error: 'Provider and providerUserId are required.' },
        { status: 400 }
      );
    }

    const linked = await SsoService.linkExternalIdentity({
      userId: session.userId,
      provider,
      providerUserId,
      email,
      metadata: body.metadata,
    });

    await SecurityNotificationService.sendNotification({
      userId: session.userId,
      userEmail: session.email,
      eventType: 'SSO_IDENTITY_LINKED',
    });

    await SecurityEventService.recordSecurityEvent({
      merchantId: session.merchantId || 'system',
      actorId: session.userId,
      actorType: 'USER',
      action: 'AUTH_IDENTITY_LINKED' as any,
      entityType: 'AUTH',
      entityId: session.userId,
      details: { provider, providerUserId, email },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully linked ${provider} account.`,
      identity: linked,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to link identity.' }, { status: 400 });
  }
}
