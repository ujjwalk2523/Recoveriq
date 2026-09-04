import { NextRequest, NextResponse } from 'next/server';
import { resolveSecurityContext } from '@/lib/security/security-context';
import { requirePermission } from '@/lib/security/authorization';
import { GovernancePolicyService } from '@/lib/governance/governance-policy-service';
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

    requirePermission(context, 'SECURITY_POLICY_MANAGE');

    const { searchParams } = new URL(req.url);
    const category = (searchParams.get('category') as any) || undefined;
    const status = (searchParams.get('status') as any) || undefined;

    const policies = await GovernancePolicyService.listPolicies({
      organizationId: orgId,
      category,
      status,
    });

    return NextResponse.json({ policies });
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

    requirePermission(context, 'SECURITY_POLICY_MANAGE');

    const body = await req.json().catch(() => ({}));
    const { name, description, category, effect, priority, conditions, status } = body;

    if (!name || !category || !effect || !conditions) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'name, category, effect, and conditions are required.' } },
        { status: 400 }
      );
    }

    const policy = await GovernancePolicyService.createPolicy({
      organizationId: orgId,
      name,
      description: description || '',
      category,
      effect,
      priority: priority !== undefined ? Number(priority) : 100,
      conditions,
      status,
      createdBy: context.userId || context.principal || 'admin',
    });

    return NextResponse.json({ policy }, { status: 201 });
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
