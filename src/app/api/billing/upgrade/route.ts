import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, canModifyPolicies } from '@/lib/auth/tenant';
import { SubscriptionService } from '@/lib/billing/subscription-service';
import { PlanCode } from '@/lib/billing/billing-types';

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantContext(req);

    if (!canModifyPolicies(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Only OWNER or ADMIN may upgrade subscription.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { targetPlan } = body;

    if (!targetPlan || !Object.values(PlanCode).includes(targetPlan)) {
      return NextResponse.json({ success: false, error: `Invalid target plan: '${targetPlan}'.` }, { status: 400 });
    }

    const sub = await SubscriptionService.changePlan(session.merchantId, targetPlan, session.email || session.role);

    return NextResponse.json({ success: true, subscription: sub });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
