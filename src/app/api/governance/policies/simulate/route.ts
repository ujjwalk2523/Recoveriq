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
    const {
      action,
      resourceType,
      resourceId,
      actorRole,
      actorType,
      environment,
      timeOfDay,
      dayOfWeek,
      mfaAge,
      severity,
    } = body;

    if (!action || !resourceType) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'action and resourceType are required for simulation.' } },
        { status: 400 }
      );
    }

    // Construct simulated context using hypothetical timestamp if timeOfDay/dayOfWeek given
    let simulatedTimestamp = new Date();
    if (timeOfDay !== undefined || dayOfWeek !== undefined) {
      const now = new Date();
      if (timeOfDay !== undefined) now.setUTCHours(Number(timeOfDay), 0, 0, 0);
      simulatedTimestamp = now;
    }

    const simulatedContext = {
      organizationId: orgId,
      actorId: context.userId || context.principal || 'usr_simulated',
      actorType: actorType || 'USER',
      role: actorRole || 'OPERATOR',
      action,
      resourceType,
      resourceId: resourceId || 'res_simulated_1',
      severity: severity || 'INFO',
      environment: environment || 'production',
      timestamp: simulatedTimestamp,
      mfaAge: mfaAge !== undefined ? Number(mfaAge) : 300,
    };

    const simulationResult = await GovernancePolicyService.simulateEvaluation({
      organizationId: orgId,
      context: simulatedContext,
    });

    return NextResponse.json(simulationResult);
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
