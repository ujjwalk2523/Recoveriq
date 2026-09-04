import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { SessionManager } from '@/lib/identity/session-manager';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const rawToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const sessions = await SessionManager.listActiveSessions(session.userId, rawToken);

  return NextResponse.json({
    success: true,
    sessions,
  });
}
