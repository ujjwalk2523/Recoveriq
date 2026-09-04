import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, canModifyPolicies } from '@/lib/auth/tenant';
import { SubscriptionService } from '@/lib/billing/subscription-service';
import { PlanCode, UsageMetric } from '@/lib/billing/billing-types';
import { UsageService } from '@/lib/billing/usage-service';
import { PLANS_CONFIG } from '@/lib/billing/plan-config';

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantContext(req);

    if (!canModifyPolicies(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Only OWNER or ADMIN may downgrade subscription.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { targetPlan } = body;

    if (!targetPlan || !Object.values(PlanCode).includes(targetPlan)) {
      return NextResponse.json({ success: false, error: `Invalid target plan: '${targetPlan}'.` }, { status: 400 });
    }

    const targetConfig = PLANS_CONFIG[targetPlan as PlanCode];
    const currentUsage = await UsageService.getUsageSummary(session.merchantId);
    const txUsed = currentUsage.metrics[UsageMetric.TRANSACTIONS_PROCESSED]?.used ?? 0;

    let warning: string | undefined;
    if (targetConfig.includedTransactions !== -1 && txUsed > targetConfig.includedTransactions) {
      warning = `Current monthly transaction usage (${txUsed}) exceeds ${targetConfig.name} plan allowance (${targetConfig.includedTransactions}). Future requests will be blocked or subject to overage. Historical usage is preserved.`;
    }

    const sub = await SubscriptionService.changePlan(session.merchantId, targetPlan, session.email || session.role);

    return NextResponse.json({
      success: true,
      subscription: sub,
      warning,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
