import { NextRequest, NextResponse } from 'next/server';
import { resolveSecurityContext } from '@/lib/security/security-context';
import { requireOrganizationAccess, requirePermission } from '@/lib/security/authorization';
import { verifyCsrf } from '@/lib/security/csrf';
import { TeamService } from '@/lib/organization/team-service';
import { ApplicationError } from '@/lib/errors/application-error';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  try {
    const { id, teamId } = await params;
    const context = await resolveSecurityContext(req);
    requireOrganizationAccess(context, id);
    requirePermission(context, 'TEAMS_VIEW');

    const members = await TeamService.listTeamMembers(id, teamId);
    return NextResponse.json({ members });
  } catch (err: any) {
    if (err instanceof ApplicationError) {
      return NextResponse.json(err.toSafeResponse(), { status: err.statusCode });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: err.message } }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  try {
    const { id, teamId } = await params;
    verifyCsrf(req);
    const context = await resolveSecurityContext(req);
    requireOrganizationAccess(context, id);
    requirePermission(context, 'TEAMS_ASSIGN_MEMBERS');

    const body = await req.json();
    const { organizationMemberId } = body;

    const assignment = await TeamService.addTeamMember({
      organizationId: id,
      teamId,
      organizationMemberId,
      actorUserId: context.userId || 'SYSTEM',
    });

    return NextResponse.json({ success: true, member: assignment }, { status: 201 });
  } catch (err: any) {
    if (err instanceof ApplicationError) {
      return NextResponse.json(err.toSafeResponse(), { status: err.statusCode });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: err.message } }, { status: 500 });
  }
}
