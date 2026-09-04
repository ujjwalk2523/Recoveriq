import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/tenant';
import { verifyCsrf } from '@/lib/security/csrf';
import { InvitationService } from '@/lib/organization/invitation-service';
import { ApplicationError } from '@/lib/errors/application-error';

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const session = await getTenantContext(req, true);
    const body = await req.json();

    const { token } = body;
    if (!token) {
      throw new ApplicationError({
        code: 'MISSING_TOKEN',
        message: 'Invitation token is required.',
        statusCode: 400,
      });
    }

    const result = await InvitationService.acceptInvitation({
      rawToken: token,
      acceptingUser: {
        userId: session.userId,
        email: session.email,
        name: session.name,
      },
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    if (err instanceof ApplicationError) {
      return NextResponse.json(err.toSafeResponse(), { status: err.statusCode });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: err.message } }, { status: 500 });
  }
}
