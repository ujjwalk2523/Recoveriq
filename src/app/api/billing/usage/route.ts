import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/tenant';
import { UsageService } from '@/lib/billing/usage-service';
import { UsageMetric } from '@/lib/billing/billing-types';

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantContext(req);
    const merchantId = session.merchantId;

    const metricParam = req.nextUrl.searchParams.get('metric');

    const summary = await UsageService.getUsageSummary(merchantId);

    if (metricParam && Object.values(UsageMetric).includes(metricParam as UsageMetric)) {
      const singleMetric = summary.metrics[metricParam];
      return NextResponse.json({
        success: true,
        merchantId,
        period: summary.period,
        planCode: summary.planCode,
        metric: singleMetric || null,
      });
    }

    return NextResponse.json({
      success: true,
      usage: summary,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to retrieve usage summary' },
      { status: 500 }
    );
  }
}
