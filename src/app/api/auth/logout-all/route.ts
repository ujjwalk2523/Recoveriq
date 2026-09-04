import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, invalidateSessionToken, getSessionFromRequest } from '@/lib/auth/session';
import { SessionManager } from '@/lib/identity/session-manager';
import { SecurityEventService } from '@/lib/security/security-events';
import { SecurityNotificationService } from '@/lib/identity/security-notification-service';
import { SECURITY_POLICY } from '@/lib/security/security-policy';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await invalidateSessionToken(token);
  }

  const revokedCount = await SessionManager.revokeAllSessionsForUser(session.userId);

  await SecurityEventService.recordSecurityEvent({
    merchantId: session.merchantId || 'system',
    actorId: session.userId,
    actorType: 'USER',
    action: 'AUTH_LOGOUT_ALL' as any,
    entityType: 'AUTH',
    entityId: session.userId,
    details: { email: session.email, revokedCount },
  });

  await SecurityNotificationService.sendNotification({
    userId: session.userId,
    userEmail: session.email,
    eventType: 'SESSION_REVOKED_ALL',
  });

  const response = NextResponse.json({
    success: true,
    message: `Signed out of all devices successfully (${revokedCount} session(s) revoked).`,
  });

  response.cookies.delete(SESSION_COOKIE_NAME);
  response.cookies.delete(SECURITY_POLICY.csrf.cookieName);

  return response;
}
