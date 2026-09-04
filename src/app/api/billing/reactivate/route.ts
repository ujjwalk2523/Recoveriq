import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, canModifyPolicies } from '@/lib/auth/tenant';
import { SubscriptionService } from '@/lib/billing/subscription-service';

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantContext(req);

    if (!canModifyPolicies(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Only OWNER or ADMIN may reactivate subscription.' },
        { status: 403 }
      );
    }

    const sub = await SubscriptionService.reactivateSubscription(session.merchantId, session.email || session.role);

    return NextResponse.json({
      success: true,
      subscription: sub,
      message: 'Subscription reactivated successfully. Cancellation request has been cleared.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
