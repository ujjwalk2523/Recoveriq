import { NextRequest, NextResponse } from 'next/server';
import { resolveSecurityContext } from '@/lib/security/security-context';
import { requirePermission } from '@/lib/security/authorization';
import { AuditService } from '@/lib/services/audit.service';
import { AuditRedactor } from '@/lib/audit/audit-redactor';
import { ApplicationError } from '@/lib/errors/application-error';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await resolveSecurityContext(req);
    const orgId = context.organizationId || context.merchantId;

    if (!orgId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } },
        { status: 401 }
      );
    }

    requirePermission(context, 'AUDIT_LOG_VIEW');

    const event = await AuditService.getEventById(id, orgId);
    if (!event) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Audit event not found.' } },
        { status: 404 }
      );
    }

    // Defensive redaction of event detail response
    const scrubbed = AuditRedactor.redact(event);
    return NextResponse.json({ event: scrubbed });
  } catch (err: any) {
    if (err instanceof ApplicationError) {
      return NextResponse.json(err.toSafeResponse(), { status: err.statusCode });
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: err.message } },
      { status: 500 }
    );
  }
}
