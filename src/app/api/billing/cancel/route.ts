import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, canModifyPolicies } from '@/lib/auth/tenant';
import { SubscriptionService } from '@/lib/billing/subscription-service';

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantContext(req);

    if (!canModifyPolicies(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Only OWNER or ADMIN may cancel subscription.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { atPeriodEnd = true } = body;

    const sub = await SubscriptionService.cancelSubscription(
      session.merchantId,
      session.email || session.role,
      atPeriodEnd
    );

    return NextResponse.json({
      success: true,
      subscription: sub,
      message: atPeriodEnd
        ? 'Cancellation scheduled for the end of the current billing period. Full access remains active until then.'
        : 'Subscription cancelled immediately.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
