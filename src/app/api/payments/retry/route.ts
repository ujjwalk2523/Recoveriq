import { NextRequest, NextResponse } from 'next/server';
import { razorpayService } from '@/lib/engine/razorpay-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await razorpayService.executeRecoveryAction(body);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Execution failed' },
      { status: 500 }
    );
  }
}
