import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, canApproveRecovery } from '@/lib/auth/tenant';
import { TransactionService } from '@/lib/services/transaction.service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getTenantContext(req);

    if (!canApproveRecovery(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Insufficient permissions to approve recoveries' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const result = await TransactionService.approveTransaction({
      merchantId: session.merchantId,
      transactionId: id,
      actionType: body.actionType,
      approvedBy: `${session.name} (${session.email})`,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to approve transaction' },
      { status: 500 }
    );
  }
}
