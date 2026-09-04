import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/tenant';
import { TimingMemoryUpdater } from '@/lib/ml/learning/timing-memory-updater';

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

    const timing = TimingMemoryUpdater.getMerchantTiming(merchantId);

    return NextResponse.json({
      success: true,
      merchantId,
      timing,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to retrieve timing performance' },
      { status: 500 }
    );
  }
}
