import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/tenant';
import { TransactionService } from '@/lib/services/transaction.service';
import { PaymentStatus } from '@/lib/engine/types';

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantContext(req);
    const { searchParams } = new URL(req.url);

    const status = searchParams.get('status') as PaymentStatus | null;
    const search = searchParams.get('search') || undefined;

    const transactions = await TransactionService.getTransactions(session.merchantId, {
      status: status || undefined,
      search,
    });

    return NextResponse.json({
      success: true,
      count: transactions.length,
      merchantId: session.merchantId,
      transactions,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
