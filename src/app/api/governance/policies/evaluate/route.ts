import { NextRequest, NextResponse } from 'next/server';
import { resolveSecurityContext } from '@/lib/security/security-context';
import { requirePermission } from '@/lib/security/authorization';
import { GovernancePolicyService } from '@/lib/governance/governance-policy-service';
import { ApplicationError } from '@/lib/errors/application-error';

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

    requirePermission(context, 'SECURITY_POLICY_MANAGE');

    const body = await req.json().catch(() => ({}));
    const { action, resourceType, resourceId, severity, environment, mfaAge, role, teamIds } = body;

    const evaluationContext = {
      organizationId: orgId,
      actorId: context.userId || context.principal || 'system',
      actorType: context.principalType || 'USER',
      role: role || (context.roles && context.roles[0]),
      action: action || 'UNKNOWN_ACTION',
      resourceType: resourceType || 'RESOURCE',
      resourceId,
      severity,
      environment: environment || process.env.NODE_ENV,
      timestamp: new Date(),
      mfaAge,
      teamIds,
    };

    const decision = await GovernancePolicyService.evaluate(evaluationContext);

    return NextResponse.json({ decision });
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
