import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, canModifyPolicies } from '@/lib/auth/tenant';
import { SubscriptionService } from '@/lib/billing/subscription-service';

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantContext(req);
    const merchantId = session.merchantId;

    if (!canModifyPolicies(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Only OWNER or ADMIN can reactivate the subscription.' },
        { status: 403 }
      );
    }

    const updated = await SubscriptionService.reactivateSubscription(
      merchantId,
      `${session.name} (${session.role})`
    );

    return NextResponse.json({
      success: true,
      message: 'Subscription has been successfully reactivated.',
      subscription: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to reactivate subscription' },
      { status: 500 }
    );
  }
}
