import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, canModifyPolicies } from '@/lib/auth/tenant';
import { BillingReconciliationService } from '@/lib/billing/billing-reconciliation';

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantContext(req);

    if (!canModifyPolicies(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Only OWNER or ADMIN may access billing reconciliation.' },
        { status: 403 }
      );
    }

    // Single merchant reconciliation or overall report
    const singleMerchant = req.nextUrl.searchParams.get('merchantId');
    if (singleMerchant && singleMerchant === session.merchantId) {
      const discrepancies = await BillingReconciliationService.reconcileMerchant(session.merchantId);
      return NextResponse.json({ success: true, discrepancies });
    }

    const report = await BillingReconciliationService.generateReconciliationReport();
    return NextResponse.json({ success: true, report });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
