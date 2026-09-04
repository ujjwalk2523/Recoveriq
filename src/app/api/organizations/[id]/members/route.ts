import { NextRequest, NextResponse } from 'next/server';
import { resolveSecurityContext } from '@/lib/security/security-context';
import { requireOrganizationAccess, requirePermission } from '@/lib/security/authorization';
import { MemberService } from '@/lib/organization/member-service';
import { ApplicationError } from '@/lib/errors/application-error';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await resolveSecurityContext(req);
    requireOrganizationAccess(context, id);
    requirePermission(context, 'MEMBERS_VIEW');

    const members = await MemberService.listMembers(id);
    return NextResponse.json({ members });
  } catch (err: any) {
    if (err instanceof ApplicationError) {
      return NextResponse.json(err.toSafeResponse(), { status: err.statusCode });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: err.message } }, { status: 500 });
  }
}
