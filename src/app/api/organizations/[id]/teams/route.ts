import { NextRequest, NextResponse } from 'next/server';
import { resolveSecurityContext } from '@/lib/security/security-context';
import { requireOrganizationAccess, requirePermission } from '@/lib/security/authorization';
import { verifyCsrf } from '@/lib/security/csrf';
import { TeamService } from '@/lib/organization/team-service';
import { ApplicationError } from '@/lib/errors/application-error';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await resolveSecurityContext(req);
    requireOrganizationAccess(context, id);
    requirePermission(context, 'TEAMS_VIEW');

    const teams = await TeamService.listTeams(id);
    return NextResponse.json({ teams });
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
    requirePermission(context, 'TEAMS_CREATE');

    const body = await req.json();
    const { name, description } = body;

    const team = await TeamService.createTeam({
      organizationId: id,
      name,
      description,
      createdBy: context.userId || 'SYSTEM',
    });

    return NextResponse.json({ success: true, team }, { status: 201 });
  } catch (err: any) {
    if (err instanceof ApplicationError) {
      return NextResponse.json(err.toSafeResponse(), { status: err.statusCode });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: err.message } }, { status: 500 });
  }
}
