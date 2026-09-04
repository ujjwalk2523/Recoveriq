import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { SsoService } from '@/lib/identity/sso-service';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const identities = await SsoService.listExternalIdentities(session.userId);

  return NextResponse.json({
    success: true,
    identities,
  });
}
