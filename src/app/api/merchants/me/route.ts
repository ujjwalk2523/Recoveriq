import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, canModifyPolicies } from '@/lib/auth/tenant';
import { MerchantService } from '@/lib/services/merchant.service';

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantContext(req);
    const merchantId = session.merchantId;

    const [overview, policies, details] = await Promise.all([
      MerchantService.getMerchantOverview(merchantId),
      MerchantService.getPolicies(merchantId),
      MerchantService.getMerchant(merchantId),
    ]);

    return NextResponse.json({
      success: true,
      merchant: overview,
      policies,
      users: details?.users || [],
      subscriptions: details?.subscriptions || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to load merchant data' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getTenantContext(req);

    if (!canModifyPolicies(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Insufficient privileges to update policies' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const updated = await MerchantService.updatePolicies(session.merchantId, body);

    return NextResponse.json({ success: true, policies: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to update merchant policies' },
      { status: 500 }
    );
  }
}
