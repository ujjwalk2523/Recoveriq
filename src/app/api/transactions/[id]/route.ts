import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/tenant';
import { TransactionService } from '@/lib/services/transaction.service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getTenantContext(req);
    const { id } = await params;

    const transaction = await TransactionService.getTransactionById(session.merchantId, id);

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      transaction,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Error fetching transaction' },
      { status: 500 }
    );
  }
}
