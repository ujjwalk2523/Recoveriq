import { NextRequest, NextResponse } from 'next/server';
import { resolveSecurityContext } from '@/lib/security/security-context';
import { requireOrganizationAccess, requirePermission } from '@/lib/security/authorization';
import { MemberService } from '@/lib/organization/member-service';
import { verifyCsrf } from '@/lib/security/csrf';
import { ApplicationError } from '@/lib/errors/application-error';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await params;
    verifyCsrf(req);
    const context = await resolveSecurityContext(req);
    requireOrganizationAccess(context, id);
    requirePermission(context, 'MEMBERS_UPDATE');

    const body = await req.json();
    const actorRole = context.roles[0];
    const actorUserId = context.userId || 'SYSTEM';

    let updated;
    if (body.role) {
      updated = await MemberService.updateMemberRole({
        organizationId: id,
        targetMemberId: memberId,
        newRole: body.role,
        actorUserId,
        actorRole,
      });
    } else if (body.status === 'SUSPENDED') {
      updated = await MemberService.suspendMember({
        organizationId: id,
        targetMemberId: memberId,
        actorUserId,
        actorRole,
      });
    } else if (body.status === 'ACTIVE') {
      updated = await MemberService.reactivateMember({
        organizationId: id,
        targetMemberId: memberId,
        actorUserId,
        actorRole,
      });
    } else {
      throw new ApplicationError({
        code: 'INVALID_REQUEST',
        message: 'Specify role or valid status (ACTIVE, SUSPENDED).',
        statusCode: 400,
      });
    }

    return NextResponse.json({ success: true, member: updated });
  } catch (err: any) {
    if (err instanceof ApplicationError) {
      return NextResponse.json(err.toSafeResponse(), { status: err.statusCode });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: err.message } }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await params;
    verifyCsrf(req);
    const context = await resolveSecurityContext(req);
    requireOrganizationAccess(context, id);
    requirePermission(context, 'MEMBERS_REMOVE');

    const actorRole = context.roles[0];
    const actorUserId = context.userId || 'SYSTEM';

    const removed = await MemberService.removeMember({
      organizationId: id,
      targetMemberId: memberId,
      actorUserId,
      actorRole,
    });

    return NextResponse.json({ success: true, member: removed });
  } catch (err: any) {
    if (err instanceof ApplicationError) {
      return NextResponse.json(err.toSafeResponse(), { status: err.statusCode });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: err.message } }, { status: 500 });
  }
}
