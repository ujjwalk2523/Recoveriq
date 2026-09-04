import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/tenant';
import { MerchantMemoryUpdater } from '@/lib/ml/learning/merchant-memory-updater';
import { ConfidenceEngine } from '@/lib/ml/learning/confidence-engine';

export async function GET(req: NextRequest) {
  try {
    let merchantId = 'mer_fintech_hub';
    try {
      const session = await getTenantContext(req);
      merchantId = session.merchantId;
    } catch {
      const urlMerchant = req.nextUrl.searchParams.get('merchantId');
      if (urlMerchant) merchantId = urlMerchant;
    }

    const intel = MerchantMemoryUpdater.getIntelligence(merchantId);
    const totalObs = (intel?.totalRecoveredPayments || 0) + (intel?.totalFailedPayments || 0);

    const breakdown = ConfidenceEngine.calculateQualityScore({
      totalObservations: totalObs,
      lastUpdatedMinutesAgo: 5,
      distinctStrategiesObserved: intel?.strategyPerformance?.length || 2,
      successRate: intel?.recoveryRate || 0.5,
    });

    return NextResponse.json({
      success: true,
      merchantId,
      quality: breakdown,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to retrieve intelligence quality' },
      { status: 500 }
    );
  }
}
