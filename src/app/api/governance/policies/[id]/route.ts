import { NextRequest, NextResponse } from 'next/server';
import { resolveSecurityContext } from '@/lib/security/security-context';
import { requirePermission } from '@/lib/security/authorization';
import { GovernancePolicyService } from '@/lib/governance/governance-policy-service';
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

    requirePermission(context, 'SECURITY_POLICY_MANAGE');

    const policy = await GovernancePolicyService.getPolicy(id, orgId);
    if (!policy) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Governance policy not found or cross-tenant access denied.' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ policy });
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

export async function PATCH(
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

    requirePermission(context, 'SECURITY_POLICY_MANAGE');

    const body = await req.json().catch(() => ({}));

    const updated = await GovernancePolicyService.updatePolicy({
      policyId: id,
      organizationId: orgId,
      name: body.name,
      description: body.description,
      category: body.category,
      priority: body.priority !== undefined ? Number(body.priority) : undefined,
      effect: body.effect,
      conditions: body.conditions,
      status: body.status,
      changeReason: body.changeReason,
      updatedBy: context.userId || context.principal || 'admin',
    });

    return NextResponse.json({ policy: updated });
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
