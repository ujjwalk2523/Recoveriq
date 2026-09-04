import { NextRequest, NextResponse } from 'next/server';
import { resolveSecurityContext } from '@/lib/security/security-context';
import { requireOrganizationAccess, requirePermission } from '@/lib/security/authorization';
import { verifyCsrf } from '@/lib/security/csrf';
import { InvitationService } from '@/lib/organization/invitation-service';
import { ApplicationError } from '@/lib/errors/application-error';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; invitationId: string }> }
) {
  try {
    const { id, invitationId } = await params;
    verifyCsrf(req);
    const context = await resolveSecurityContext(req);
    requireOrganizationAccess(context, id);
    requirePermission(context, 'MEMBERS_INVITE');

    await InvitationService.revokeInvitation({
      organizationId: id,
      invitationId,
      actorUserId: context.userId || 'SYSTEM',
      actorRole: context.roles[0],
    });

    return NextResponse.json({ success: true, message: 'Invitation revoked.' });
  } catch (err: any) {
    if (err instanceof ApplicationError) {
      return NextResponse.json(err.toSafeResponse(), { status: err.statusCode });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: err.message } }, { status: 500 });
  }
}
