import { NextRequest, NextResponse } from 'next/server';
import { resolveSecurityContext } from '@/lib/security/security-context';
import { requirePermission } from '@/lib/security/authorization';
import { AuditAnomalyEngine } from '@/lib/audit/audit-anomaly-engine';
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

    const { searchParams } = new URL(req.url);
    const requestedOrg = searchParams.get('organizationId');

    if (requestedOrg && requestedOrg !== orgId) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Cross-tenant anomaly access denied.' } },
        { status: 403 }
      );
    }

    requirePermission(context, 'AUDIT_LOG_VIEW');

    const lookbackParam = searchParams.get('lookbackDays');
    const recentParam = searchParams.get('recentWindowHours');

    const lookbackDays = lookbackParam ? parseInt(lookbackParam, 10) : 30;
    const recentWindowHours = recentParam ? parseInt(recentParam, 10) : 2;

    const result = await AuditAnomalyEngine.detectAnomalies({
      organizationId: orgId,
      lookbackDays,
      recentWindowHours,
    });

    return NextResponse.json(result);
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
