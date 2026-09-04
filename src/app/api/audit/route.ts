import { NextRequest, NextResponse } from 'next/server';
import { resolveSecurityContext } from '@/lib/security/security-context';
import { requirePermission } from '@/lib/security/authorization';
import { AuditService } from '@/lib/services/audit.service';
import { AuditRedactor } from '@/lib/audit/audit-redactor';
import { ApplicationError } from '@/lib/errors/application-error';
import { ActorType, AuditCategory, AuditSeverity, AuditResult } from '@/lib/audit/audit-types';

export async function GET(req: NextRequest) {
  try {
    const context = await resolveSecurityContext(req);
    const orgId = context.organizationId || context.merchantId;

    if (!orgId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication and active organization required.' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const requestedOrg = searchParams.get('organizationId');

    // Tenant Isolation: Fail closed if client requests another organization's audit ledger
    if (requestedOrg && requestedOrg !== orgId) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Cross-tenant audit ledger access denied.' } },
        { status: 403 }
      );
    }

    // Permission enforcement
    requirePermission(context, 'AUDIT_LOG_VIEW');

    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const cursor = searchParams.get('cursor') || undefined;
    const direction = searchParams.get('direction') === 'ASC' ? 'ASC' : 'DESC';

    const action = searchParams.get('action') || undefined;
    const category = (searchParams.get('category') as AuditCategory) || undefined;
    const severity = (searchParams.get('severity') as AuditSeverity) || undefined;
    const result = (searchParams.get('result') as AuditResult) || undefined;
    const actorType = (searchParams.get('actorType') as ActorType) || undefined;
    const actorId = searchParams.get('actorId') || undefined;
    const resourceType = searchParams.get('resourceType') || undefined;
    const resourceId = searchParams.get('resourceId') || undefined;
    const merchantId = searchParams.get('merchantId') || undefined;

    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    const queryResult = await AuditService.getEvents({
      organizationId: orgId,
      merchantId,
      action,
      category,
      severity,
      result,
      actorType,
      actorId,
      resourceType,
      resourceId,
      startDate,
      endDate,
      cursor,
      limit,
      direction,
    });

    // Redact all responses defensively
    const scrubbedEvents = queryResult.events.map(event => AuditRedactor.redact(event));

    return NextResponse.json({
      events: scrubbedEvents,
      nextCursor: queryResult.nextCursor,
      totalCount: queryResult.totalCount,
    });
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
