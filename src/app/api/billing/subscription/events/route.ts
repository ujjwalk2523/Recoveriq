import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/tenant';
import { SubscriptionService } from '@/lib/billing/subscription-service';

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantContext(req);
    const merchantId = session.merchantId;

    const events = await SubscriptionService.getSubscriptionEvents(merchantId);

    return NextResponse.json({
      success: true,
      events,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to retrieve subscription events' },
      { status: 500 }
    );
  }
}
