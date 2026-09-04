import { NextRequest, NextResponse } from 'next/server';
import { resolveSecurityContext } from '@/lib/security/security-context';
import { requirePermission } from '@/lib/security/authorization';
import { ComplianceEvidenceService } from '@/lib/compliance/compliance-evidence-service';
import { ApplicationError } from '@/lib/errors/application-error';

export async function GET(req: NextRequest) {
  try {
    const context = await resolveSecurityContext(req);
    const orgId = context.organizationId || context.merchantId;

    if (!orgId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } },
        { status: 401 }
      );
    }

    requirePermission(context, 'AUDIT_LOG_VIEW');

    const { searchParams } = new URL(req.url);
    const controlId = searchParams.get('controlId') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;

    const packages = await ComplianceEvidenceService.listEvidencePackages({
      organizationId: orgId,
      controlId,
      limit,
    });

    return NextResponse.json({ packages });
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

export async function POST(req: NextRequest) {
  try {
    const context = await resolveSecurityContext(req);
    const orgId = context.organizationId || context.merchantId;

    if (!orgId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } },
        { status: 401 }
      );
    }

    // Creating evidence packages requires administrative authority
    requirePermission(context, 'AUDIT_LOG_VIEW');

    const body = await req.json().catch(() => ({}));
    const { controlId, periodStart, periodEnd, title, description } = body;

    if (!controlId || !periodStart || !periodEnd) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'controlId, periodStart, and periodEnd are required.' } },
        { status: 400 }
      );
    }

    const pkg = await ComplianceEvidenceService.generateEvidencePackage({
      organizationId: orgId,
      controlId,
      periodStart,
      periodEnd,
      generatedBy: context.userId || context.principal || 'system',
      title,
      description,
    });

    return NextResponse.json({ package: pkg }, { status: 201 });
  } catch (err: any) {
    if (err instanceof ApplicationError) {
      return NextResponse.json(err.toSafeResponse(), { status: err.statusCode });
    }
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: err.message } },
      { status: 400 }
    );
  }
}
