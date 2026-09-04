import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/tenant';
import { StrategyMemoryUpdater } from '@/lib/ml/learning/strategy-memory-updater';

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

    const strategies = StrategyMemoryUpdater.getMerchantStrategies(merchantId);

    return NextResponse.json({
      success: true,
      merchantId,
      strategies,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to retrieve strategy performance' },
      { status: 500 }
    );
  }
}
