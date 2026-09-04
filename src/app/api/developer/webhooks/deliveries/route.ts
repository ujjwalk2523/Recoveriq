import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/tenant';
import { WebhookDeliveryService } from '@/lib/webhooks/delivery-service';
import { WebhookDeliveryStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantContext(req);
    const statusParam = req.nextUrl.searchParams.get('status');
    const endpointId = req.nextUrl.searchParams.get('endpointId') || undefined;
    const limitParam = req.nextUrl.searchParams.get('limit');
    const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10))) : 30;

    const status = statusParam && Object.values(WebhookDeliveryStatus).includes(statusParam as any)
      ? (statusParam as WebhookDeliveryStatus)
      : undefined;

    const deliveries = await WebhookDeliveryService.listDeliveries(session.merchantId, {
      endpointId,
      status,
      limit,
    });

    return NextResponse.json({ success: true, deliveries });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch deliveries' },
      { status: 500 }
    );
  }
}
