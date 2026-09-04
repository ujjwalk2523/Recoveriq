import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { SessionManager } from '@/lib/identity/session-manager';
import { SecurityEventService } from '@/lib/security/security-events';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const { id: sessionId } = await params;
  if (!sessionId) {
    return NextResponse.json({ success: false, error: 'Session ID is required.' }, { status: 400 });
  }

  // Prevent revoking the current session via this endpoint (use logout instead)
  if (session.sessionId === sessionId) {
    return NextResponse.json(
      { success: false, error: 'Cannot revoke current session via this endpoint. Please use Log Out.' },
      { status: 400 }
    );
  }

  const revoked = await SessionManager.revokeSession(sessionId, session.userId);
  if (!revoked) {
    return NextResponse.json({ success: false, error: 'Session not found or already revoked.' }, { status: 404 });
  }

  await SecurityEventService.recordSecurityEvent({
    merchantId: session.merchantId || 'system',
    actorId: session.userId,
    actorType: 'USER',
    action: 'AUTH_SESSION_REVOKED' as any,
    entityType: 'AUTH',
    entityId: sessionId,
    details: { email: session.email, targetSessionId: sessionId },
  });

  return NextResponse.json({
    success: true,
    message: 'Session revoked successfully.',
  });
}
