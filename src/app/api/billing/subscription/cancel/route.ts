import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, canModifyPolicies } from '@/lib/auth/tenant';
import { SubscriptionService } from '@/lib/billing/subscription-service';

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantContext(req);
    const merchantId = session.merchantId;

    if (!canModifyPolicies(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Only OWNER or ADMIN can cancel the subscription.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const cancelAtEnd = body.cancelAtPeriodEnd ?? false;

    const updated = await SubscriptionService.cancelSubscription(
      merchantId,
      `${session.name} (${session.role})`,
      cancelAtEnd
    );

    return NextResponse.json({
      success: true,
      message: 'Subscription has been cancelled.',
      subscription: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
