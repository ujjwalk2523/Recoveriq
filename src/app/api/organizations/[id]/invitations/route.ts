import { NextRequest, NextResponse } from 'next/server';
import { resolveSecurityContext } from '@/lib/security/security-context';
import { requireOrganizationAccess, requirePermission } from '@/lib/security/authorization';
import { verifyCsrf } from '@/lib/security/csrf';
import { InvitationService } from '@/lib/organization/invitation-service';
import { ApplicationError } from '@/lib/errors/application-error';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await resolveSecurityContext(req);
    requireOrganizationAccess(context, id);
    requirePermission(context, 'MEMBERS_VIEW');

    const invitations = await InvitationService.listInvitations(id);
    return NextResponse.json({ invitations });
  } catch (err: any) {
    if (err instanceof ApplicationError) {
      return NextResponse.json(err.toSafeResponse(), { status: err.statusCode });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: err.message } }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    verifyCsrf(req);
    const context = await resolveSecurityContext(req);
    requireOrganizationAccess(context, id);
    requirePermission(context, 'MEMBERS_INVITE');

    const body = await req.json();
    const { email, role } = body;

    const result = await InvitationService.createInvitation({
      organizationId: id,
      email,
      role: role || 'OPERATOR',
      invitedByUserId: context.userId || 'SYSTEM',
      actorRole: context.roles[0],
    });

    return NextResponse.json({ success: true, invitation: result.invitation }, { status: 201 });
  } catch (err: any) {
    if (err instanceof ApplicationError) {
      return NextResponse.json(err.toSafeResponse(), { status: err.statusCode });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: err.message } }, { status: 500 });
  }
}
