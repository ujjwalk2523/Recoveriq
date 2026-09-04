import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/tenant';
import { AnomalyDetector } from '@/lib/ml/learning/anomaly-detector';

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

    const anomalies = AnomalyDetector.getMerchantAnomalies(merchantId);

    return NextResponse.json({
      success: true,
      merchantId,
      anomalies,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to retrieve anomalies' },
      { status: 500 }
    );
  }
}
