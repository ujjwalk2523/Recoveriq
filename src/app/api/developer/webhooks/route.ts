import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, canModifyPolicies } from '@/lib/auth/tenant';
import { WebhookEndpointService } from '@/lib/webhooks/endpoint-service';
import { WebhookDeliveryService } from '@/lib/webhooks/delivery-service';
import { WebhookHealthCalculator } from '@/lib/webhooks/webhook-health';

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantContext(req);
    const endpoints = await WebhookEndpointService.listEndpoints(session.merchantId);

    // Attach health metrics to each endpoint
    const enriched = await Promise.all(
      endpoints.map(async (e) => {
        const deliveries = await WebhookDeliveryService.listDeliveries(session.merchantId, {
          endpointId: e.id,
          limit: 30,
        });
        const health = WebhookHealthCalculator.evaluateHealth(deliveries);
        return {
          ...e,
          health,
        };
      })
    );

    return NextResponse.json({ success: true, endpoints: enriched });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to list webhook endpoints' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantContext(req);

    if (!canModifyPolicies(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions. Only OWNER or ADMIN may configure webhooks.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { url, description, subscribedEvents } = body;

    const result = await WebhookEndpointService.createEndpoint({
      merchantId: session.merchantId,
      url,
      description,
      subscribedEvents,
      createdBy: session.email || session.role,
    });

    return NextResponse.json({
      success: true,
      endpoint: result.endpoint,
      rawSecret: result.rawSecret,
      warning: 'Store this webhook secret securely. It will never be shown again.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to create webhook endpoint' },
      { status: 400 }
    );
  }
}
