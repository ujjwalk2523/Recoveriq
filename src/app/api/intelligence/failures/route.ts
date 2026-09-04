import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/tenant';
import { FailurePatternUpdater } from '@/lib/ml/learning/failure-pattern-updater';

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

    const patterns = FailurePatternUpdater.getMerchantPatterns(merchantId);

    return NextResponse.json({
      success: true,
      merchantId,
      patterns,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to retrieve failure patterns' },
      { status: 500 }
    );
  }
}
