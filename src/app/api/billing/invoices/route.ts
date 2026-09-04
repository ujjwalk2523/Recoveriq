import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/tenant';
import { InvoiceService } from '@/lib/billing/invoice-service';

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantContext(req);
    const limitParam = req.nextUrl.searchParams.get('limit');
    const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10))) : 20;

    const invoices = await InvoiceService.listInvoices(session.merchantId, limit);

    return NextResponse.json({
      success: true,
      invoices,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
