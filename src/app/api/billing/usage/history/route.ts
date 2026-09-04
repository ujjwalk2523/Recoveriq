import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/tenant';
import { UsageService } from '@/lib/billing/usage-service';
import { UsageMetric } from '@/lib/billing/billing-types';

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantContext(req);
    const merchantId = session.merchantId;

    const metricParam = req.nextUrl.searchParams.get('metric');
    const limitParam = req.nextUrl.searchParams.get('limit');
    const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10))) : 50;

    const metric =
      metricParam && Object.values(UsageMetric).includes(metricParam as UsageMetric)
        ? (metricParam as UsageMetric)
        : undefined;

    const history = await UsageService.getUsageHistory(merchantId, metric, limit);

    return NextResponse.json({
      success: true,
      merchantId,
      history,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to retrieve usage history' },
      { status: 500 }
    );
  }
}
