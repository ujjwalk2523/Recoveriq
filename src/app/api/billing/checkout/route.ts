import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, canModifyPolicies } from '@/lib/auth/tenant';
import { CheckoutService } from '@/lib/billing/checkout-service';
import { PlanCode } from '@/lib/billing/billing-types';

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantContext(req);

    if (!canModifyPolicies(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Only OWNER or ADMIN may initiate subscription checkout.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { planCode, billingPeriod = 'MONTHLY' } = body;

    if (!planCode || !Object.values(PlanCode).includes(planCode)) {
      return NextResponse.json({ success: false, error: `Invalid plan code: '${planCode}'.` }, { status: 400 });
    }

    const checkoutSession = await CheckoutService.createCheckoutSession({
      merchantId: session.merchantId,
      planCode,
      billingPeriod,
      customerEmail: session.email || 'billing@merchant.com',
      customerName: session.name || 'Merchant Administrator',
      actor: session.email || session.role,
    });

    return NextResponse.json({
      success: true,
      session: checkoutSession,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Checkout creation failed.' }, { status: 500 });
  }
}
