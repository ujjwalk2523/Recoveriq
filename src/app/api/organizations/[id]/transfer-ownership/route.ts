import { NextRequest, NextResponse } from 'next/server';
import { resolveSecurityContext } from '@/lib/security/security-context';
import { requireOrganizationAccess, requireOwner } from '@/lib/security/authorization';
import { verifyCsrf } from '@/lib/security/csrf';
import { OwnershipService } from '@/lib/organization/ownership-service';
import { ApplicationError } from '@/lib/errors/application-error';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    verifyCsrf(req);
    const context = await resolveSecurityContext(req);
    requireOrganizationAccess(context, id);
    requireOwner(context); // Caller must be an OWNER

    const body = await req.json();
    const { targetMemberId, confirmPhrase } = body;

    const result = await OwnershipService.transferOwnership({
      organizationId: id,
      currentOwnerUserId: context.userId || 'SYSTEM',
      targetMemberId,
      confirmPhrase,
      requestId: context.requestId,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    if (err instanceof ApplicationError) {
      return NextResponse.json(err.toSafeResponse(), { status: err.statusCode });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: err.message } }, { status: 500 });
  }
}
