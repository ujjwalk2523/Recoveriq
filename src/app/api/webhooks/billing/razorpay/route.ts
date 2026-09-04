import { NextRequest, NextResponse } from 'next/server';
import { BillingWebhookProcessor } from '@/lib/billing/billing-webhooks';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature') || '';

    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    const result = await BillingWebhookProcessor.processWebhook(rawBody, signature, headers);

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Billing webhook signature verification failed',
      },
      { status: 400 }
    );
  }
}
