import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/tenant';
import { TransactionService } from '@/lib/services/transaction.service';
import { PaymentStatus } from '@/lib/engine/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    return NextResponse.json(
      {
        success: true,
        count: transactions.length,
        merchantId: session.merchantId,
        transactions,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
