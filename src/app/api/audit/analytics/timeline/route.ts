import { NextRequest, NextResponse } from 'next/server';
import { resolveSecurityContext } from '@/lib/security/security-context';
import { requirePermission } from '@/lib/security/authorization';
import { AuditAnalyticsService } from '@/lib/audit/audit-analytics-service';
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
        { error: { code: 'FORBIDDEN', message: 'Cross-tenant access denied.' } },
        { status: 403 }
      );
    }

    requirePermission(context, 'AUDIT_LOG_VIEW');

    const correlationKey = searchParams.get('correlationKey') as any;
    const correlationValue = searchParams.get('correlationValue');

    if (!correlationKey || !['requestId', 'sessionId', 'actorId', 'resourceId'].includes(correlationKey)) {
      return NextResponse.json(
        { error: { code: 'INVALID_CORRELATION_KEY', message: "correlationKey must be 'requestId', 'sessionId', 'actorId', or 'resourceId'." } },
        { status: 400 }
      );
    }

    if (!correlationValue || correlationValue.trim().length === 0) {
      return NextResponse.json(
        { error: { code: 'MISSING_CORRELATION_VALUE', message: 'correlationValue parameter is required.' } },
        { status: 400 }
      );
    }

    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    const timeline = await AuditAnalyticsService.getInvestigationTimeline({
      organizationId: orgId,
      correlationKey,
      correlationValue: correlationValue.trim(),
      limit,
    });

    return NextResponse.json(timeline);
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
