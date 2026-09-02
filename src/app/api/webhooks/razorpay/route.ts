import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    console.log('[RecoverIQ Webhook Ingestion]', payload?.event);
    return NextResponse.json({ received: true, event: payload?.event || 'payment.failed' });
  } catch (error: any) {
    return NextResponse.json({ received: false, error: error?.message }, { status: 400 });
  }
}
