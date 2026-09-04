import { NextRequest, NextResponse } from 'next/server';
import {
  verifyWebhookSignature,
  validateWebhookFreshness,
  validateWebhookEnvironment,
} from '@/lib/razorpay/verify';
import { RazorpayWebhookService } from '@/lib/razorpay/webhooks';

export async function POST(req: NextRequest) {
  try {
    // 1. Extract raw body text to preserve exact bytes for HMAC validation
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature');

    // 2. Mandatory Cryptographic Signature Verification
    const isValid = verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.warn('[Razorpay Webhook] Rejected: Invalid HMAC-SHA256 signature.');
      return NextResponse.json(
        {
          received: false,
          error: 'Unauthorized: Invalid Razorpay webhook signature.',
        },
        { status: 401 }
      );
    }

    // 3. Parse JSON payload safely
    const payload = JSON.parse(rawBody);

    // 4. Replay Protection / Freshness Validation
    const freshness = validateWebhookFreshness(payload.created_at);
    if (!freshness.valid) {
      console.warn(`[Razorpay Webhook] Rejected replay: ${freshness.reason}`);
      return NextResponse.json(
        {
          received: false,
          error: freshness.reason,
        },
        { status: 400 }
      );
    }

    // 5. Webhook Environment Isolation Check
    const envCheck = validateWebhookEnvironment(payload);
    if (!envCheck.valid) {
      console.warn(`[Razorpay Webhook] Rejected environment mismatch: ${envCheck.reason}`);
      return NextResponse.json(
        {
          received: false,
          error: envCheck.reason,
        },
        { status: 422 }
      );
    }

    // 6. Delegate to Webhook Service (Idempotency + Event Processor)
    const result = await RazorpayWebhookService.processWebhook(payload);

    return NextResponse.json({
      received: true,
      ...result,
    });
  } catch (error: any) {
    console.error('[Razorpay Webhook Route Error]', error);
    return NextResponse.json(
      {
        received: false,
        error: error?.message || 'Failed to process webhook',
      },
      { status: 500 }
    );
  }
}
