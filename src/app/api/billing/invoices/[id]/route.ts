import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/tenant';
import { InvoiceService } from '@/lib/billing/invoice-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getTenantContext(req);
    const { id } = await params;

    const invoice = await InvoiceService.getInvoice(id, session.merchantId);
    if (!invoice) {
      return NextResponse.json(
        { success: false, error: `Invoice '${id}' not found for authenticated merchant.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      invoice,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
