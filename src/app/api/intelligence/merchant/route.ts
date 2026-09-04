import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/tenant';
import { prisma } from '@/lib/db/prisma';
import { MerchantMemoryUpdater } from '@/lib/ml/learning/merchant-memory-updater';

export async function GET(req: NextRequest) {
  try {
    let merchantId = 'mer_fintech_hub';
    try {
      const session = await getTenantContext(req);
      merchantId = session.merchantId;
    } catch {
      // Fallback for public demo / automated test query parameter
      const urlMerchant = req.nextUrl.searchParams.get('merchantId');
      if (urlMerchant) merchantId = urlMerchant;
    }

    // 1. Try DB first
    let intelligence: any = null;
    if (process.env.SKIP_DB !== 'true') {
      try {
        intelligence = await prisma.merchantRecoveryIntelligence.findUnique({
          where: { merchantId },
        });
      } catch {
        // resilient
      }
    }

    // 2. Fallback to in-memory store
    if (!intelligence) {
      intelligence = MerchantMemoryUpdater.getIntelligence(merchantId) || {
        merchantId,
        totalFailedPayments: 0,
        totalRecoveredPayments: 0,
        recoveryRate: 0.5,
        totalRecoveryRevenue: 0.0,
        totalRecoveryCost: 0.0,
        totalNetRecoveryRevenue: 0.0,
        averageReward: 0.0,
        bestStrategy: 'PAYMENT_LINK',
        bestTimingBucket: 'MEDIUM_30_60M',
        intelligenceQuality: 50.0,
        evidenceLevel: 'LOW',
        coldStart: true,
        coldStartReason: 'Insufficient historical recovery observations (<30 samples).',
        modelVersion: 'RecoverIQ-Intelligence-v1.0',
        lastUpdatedAt: new Date().toISOString(),
      };
    }

    return NextResponse.json({
      success: true,
      merchantId,
      intelligence,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to retrieve merchant intelligence' },
      { status: 500 }
    );
  }
}
