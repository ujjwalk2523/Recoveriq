import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/tenant';
import { SubscriptionService } from '@/lib/billing/subscription-service';
import { EntitlementService } from '@/lib/billing/entitlement-service';
import { PlanService } from '@/lib/billing/plan-service';

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantContext(req);
    const merchantId = session.merchantId;

    const [subscription, entitlements, usage] = await Promise.all([
      SubscriptionService.getSubscription(merchantId),
      EntitlementService.getMerchantEntitlements(merchantId),
      EntitlementService.getPlanUsage(merchantId),
    ]);

    const plan = await PlanService.getPlan(subscription.planCode);

    return NextResponse.json({
      success: true,
      subscription: {
        ...subscription,
        plan,
        isTrialActive: SubscriptionService.isTrialActive(subscription),
        isSubscriptionActive: SubscriptionService.isSubscriptionActive(subscription),
        isPastDue: SubscriptionService.isPastDue(subscription),
        isSuspended: SubscriptionService.isSuspended(subscription),
        isExpired: SubscriptionService.isExpired(subscription),
      },
      entitlements,
      usage,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to retrieve subscription' },
      { status: 500 }
    );
  }
}
