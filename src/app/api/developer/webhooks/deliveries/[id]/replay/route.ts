import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, canModifyPolicies } from '@/lib/auth/tenant';
import { WebhookDeliveryService } from '@/lib/webhooks/delivery-service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getTenantContext(req);
    if (!canModifyPolicies(session.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const replayed = await WebhookDeliveryService.replayDelivery(
      id,
      session.merchantId,
      session.email || session.role
    );

    return NextResponse.json({ success: true, delivery: replayed });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
