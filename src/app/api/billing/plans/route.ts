import { NextRequest, NextResponse } from 'next/server';
import { PlanService } from '@/lib/billing/plan-service';

export async function GET(req: NextRequest) {
  try {
    const plans = await PlanService.listActivePlans();
    return NextResponse.json({
      success: true,
      plans,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to list plans' },
      { status: 500 }
    );
  }
}
