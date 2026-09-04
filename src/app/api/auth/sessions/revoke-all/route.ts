import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { SessionManager } from '@/lib/identity/session-manager';
import { SecurityEventService } from '@/lib/security/security-events';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  // Revoke all other sessions except the current one
  const revokedCount = await SessionManager.revokeAllSessionsForUser(session.userId, session.sessionId);

  await SecurityEventService.recordSecurityEvent({
    merchantId: session.merchantId || 'system',
    actorId: session.userId,
    actorType: 'USER',
    action: 'AUTH_SESSION_REVOKED_ALL' as any,
    entityType: 'AUTH',
    entityId: session.userId,
    details: { email: session.email, revokedCount, preservedCurrent: Boolean(session.sessionId) },
  });

  return NextResponse.json({
    success: true,
    revokedCount,
    message: `Successfully revoked ${revokedCount} other active session(s).`,
  });
}
