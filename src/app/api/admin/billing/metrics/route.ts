import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, canModifyPolicies } from '@/lib/auth/tenant';
import { BillingMetricsService } from '@/lib/billing/billing-metrics';

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantContext(req);

    if (!canModifyPolicies(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Only OWNER or ADMIN may access platform metrics.' },
        { status: 403 }
      );
    }

    const metrics = await BillingMetricsService.calculateMetrics();
    return NextResponse.json({ success: true, metrics });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
