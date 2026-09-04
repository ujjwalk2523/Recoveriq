import { NextRequest, NextResponse } from 'next/server';
import { resolveSecurityContext } from '@/lib/security/security-context';
import { requireOrganizationAccess, requirePermission } from '@/lib/security/authorization';
import { verifyCsrf } from '@/lib/security/csrf';
import { TeamService } from '@/lib/organization/team-service';
import { ApplicationError } from '@/lib/errors/application-error';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string; memberId: string }> }
) {
  try {
    const { id, teamId, memberId } = await params;
    verifyCsrf(req);
    const context = await resolveSecurityContext(req);
    requireOrganizationAccess(context, id);
    requirePermission(context, 'TEAMS_ASSIGN_MEMBERS');

    await TeamService.removeTeamMember({
      organizationId: id,
      teamId,
      organizationMemberId: memberId,
      actorUserId: context.userId || 'SYSTEM',
    });

    return NextResponse.json({ success: true, message: 'Member removed from team.' });
  } catch (err: any) {
    if (err instanceof ApplicationError) {
      return NextResponse.json(err.toSafeResponse(), { status: err.statusCode });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: err.message } }, { status: 500 });
  }
}
