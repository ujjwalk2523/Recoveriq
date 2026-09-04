import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, invalidateSessionToken, getSessionFromRequest } from '@/lib/auth/session';
import { SessionManager } from '@/lib/identity/session-manager';
import { SecurityEventService } from '@/lib/security/security-events';
import { SECURITY_POLICY } from '@/lib/security/security-policy';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionFromRequest(req);

  if (token) {
    await invalidateSessionToken(token);
  }

  if (session) {
    if (session.sessionId) {
      await SessionManager.revokeSession(session.sessionId, session.userId);
    }

    await SecurityEventService.recordSecurityEvent({
      merchantId: session.merchantId || 'system',
      actorId: session.userId,
      actorType: 'USER',
      action: 'AUTH_LOGOUT' as any,
      entityType: 'AUTH',
      entityId: session.userId,
      details: { email: session.email },
    });
  }

  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });

  // Invalidate browser cookies
  response.cookies.delete(SESSION_COOKIE_NAME);
  response.cookies.delete(SECURITY_POLICY.csrf.cookieName);

  return response;
}
