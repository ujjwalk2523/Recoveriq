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

    const team = await TeamService.getTeam(id, teamId);
    if (!team) {
      return NextResponse.json({ error: { code: 'TEAM_NOT_FOUND', message: 'Team not found' } }, { status: 404 });
    }

    return NextResponse.json({ team });
  } catch (err: any) {
    if (err instanceof ApplicationError) {
      return NextResponse.json(err.toSafeResponse(), { status: err.statusCode });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: err.message } }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  try {
    const { id, teamId } = await params;
    verifyCsrf(req);
    const context = await resolveSecurityContext(req);
    requireOrganizationAccess(context, id);
    requirePermission(context, 'TEAMS_UPDATE');

    const body = await req.json();
    const updated = await TeamService.updateTeam({
      organizationId: id,
      teamId,
      name: body.name,
      description: body.description,
      status: body.status,
      actorUserId: context.userId || 'SYSTEM',
    });

    return NextResponse.json({ success: true, team: updated });
  } catch (err: any) {
    if (err instanceof ApplicationError) {
      return NextResponse.json(err.toSafeResponse(), { status: err.statusCode });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: err.message } }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  try {
    const { id, teamId } = await params;
    verifyCsrf(req);
    const context = await resolveSecurityContext(req);
    requireOrganizationAccess(context, id);
    requirePermission(context, 'TEAMS_DELETE');

    const archived = await TeamService.archiveTeam({
      organizationId: id,
      teamId,
      actorUserId: context.userId || 'SYSTEM',
    });

    return NextResponse.json({ success: true, team: archived });
  } catch (err: any) {
    if (err instanceof ApplicationError) {
      return NextResponse.json(err.toSafeResponse(), { status: err.statusCode });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: err.message } }, { status: 500 });
  }
}
