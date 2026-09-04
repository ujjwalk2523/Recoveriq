import { NextRequest, NextResponse } from 'next/server';
import { resolveSecurityContext } from '@/lib/security/security-context';
import { requirePermission } from '@/lib/security/authorization';
import { ComplianceEvidenceService } from '@/lib/compliance/compliance-evidence-service';
import { ApplicationError } from '@/lib/errors/application-error';

export async function POST(
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

    const result = await ComplianceEvidenceService.verifyEvidencePackage({
      packageId: id,
      organizationId: orgId,
    });

    return NextResponse.json({ verification: result });
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
