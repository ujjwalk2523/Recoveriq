import { NextRequest, NextResponse } from 'next/server';
import { resolveSecurityContext } from '@/lib/security/security-context';
import { requirePermission } from '@/lib/security/authorization';
import { AuditAnalyticsService } from '@/lib/audit/audit-analytics-service';
import { ApplicationError } from '@/lib/errors/application-error';
import { AuditTimeWindow } from '@/lib/audit/audit-analytics-types';

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
        { error: { code: 'FORBIDDEN', message: 'Cross-tenant access denied.' } },
        { status: 403 }
      );
    }

    requirePermission(context, 'AUDIT_LOG_VIEW');

    const window = (searchParams.get('window') as AuditTimeWindow) || 'LAST_30_DAYS';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    const security = await AuditAnalyticsService.getSecurityAnalytics({
      organizationId: orgId,
      filter: { window, startDate, endDate },
    });

    return NextResponse.json({ security });
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
