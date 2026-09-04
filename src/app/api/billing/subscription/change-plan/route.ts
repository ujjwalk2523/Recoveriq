import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, canModifyPolicies } from '@/lib/auth/tenant';
import { SubscriptionService } from '@/lib/billing/subscription-service';
import { PlanCode } from '@/lib/billing/billing-types';
import { PLANS_CONFIG } from '@/lib/billing/plan-config';

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantContext(req);
    const merchantId = session.merchantId;

    // RBAC: Only OWNER or ADMIN can change subscription
    if (!canModifyPolicies(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Only OWNER or ADMIN can modify the subscription plan.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { newPlanCode } = body;

    if (!newPlanCode || !PLANS_CONFIG[newPlanCode as PlanCode]) {
      return NextResponse.json(
        { success: false, error: `Invalid plan code '${newPlanCode}'. Available: STARTER, GROWTH, SCALE, ENTERPRISE.` },
        { status: 400 }
      );
    }

    const updated = await SubscriptionService.changePlan(
      merchantId,
      newPlanCode as PlanCode,
      `${session.name} (${session.role})`
    );

    return NextResponse.json({
      success: true,
      message: `Successfully updated subscription plan to ${newPlanCode}.`,
      subscription: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to change subscription plan' },
      { status: 500 }
    );
  }
}
