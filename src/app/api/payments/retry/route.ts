import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, canApproveRecovery } from '@/lib/auth/tenant';
import { verifyCsrf } from '@/lib/security/csrf';
import { prisma } from '@/lib/db/prisma';
import { IN_MEMORY_TRANSACTIONS } from '@/lib/razorpay/webhooks';
import { RecoveryExecutor } from '@/lib/execution/recovery-executor';
import { SecurityEventService } from '@/lib/security/security-events';
import { validateIntegerPaise } from '@/lib/security/input-security';
import { RecoveryActionType } from '@/lib/engine/types';

export async function POST(req: NextRequest) {
  try {
    // 1. Enforce CSRF protection for browser state-changing requests
    verifyCsrf(req);

    // 2. Authenticate session & enforce tenant boundary
    const session = await getTenantContext(req);

    if (!canApproveRecovery(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Insufficient role to trigger payment recovery.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { transactionId, actionType = 'IMMEDIATE_RETRY' } = body;

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: transactionId.' },
        { status: 400 }
      );
    }

    // 3. Resolve Authoritative Transaction from PostgreSQL or in-memory ledger
    let txn: any = null;
    if (process.env.SKIP_DB !== 'true') {
      try {
        txn = await prisma.transaction.findFirst({
          where: { id: transactionId, merchantId: session.merchantId },
          include: { customer: true },
        });
      } catch {
        // ignore
      }
    }
    if (!txn) {
      const memTxn = IN_MEMORY_TRANSACTIONS.get(transactionId);
      if (memTxn && memTxn.merchantId === session.merchantId) {
        txn = memTxn;
      }
    }

    if (!txn) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found or access denied.' },
        { status: 404 }
      );
    }

    // 4. Money Security: Amount is derived authoritatively from database, NEVER client
    const authoritativeAmount = validateIntegerPaise(txn.amount, 'transaction.amount');

    // Reject if client attempted to manipulate the payment amount
    if (body.amount !== undefined && body.amount !== authoritativeAmount) {
      return NextResponse.json(
        {
          success: false,
          error: `Amount manipulation detected: Request amount ₹${body.amount} does not match authoritative amount ₹${authoritativeAmount}.`,
        },
        { status: 400 }
      );
    }

    // 5. Delegate strictly to authoritative RecoveryExecutor
    const executionResult = await RecoveryExecutor.executeAction({
      merchantId: session.merchantId,
      transactionId: txn.id,
      sequenceId: txn.sequenceId || `seq_manual_${txn.id}`,
      stepNumber: 1,
      actionType: actionType as RecoveryActionType,
      amount: authoritativeAmount,
      customerPhone: txn.customerPhone || txn.customer?.phone || '+919876543210',
      customerEmail: txn.customerEmail || txn.customer?.email,
      customerName: txn.customerName || txn.customer?.name,
    });

    // 6. Record Security Event
    await SecurityEventService.recordSecurityEvent({
      merchantId: session.merchantId,
      actorId: session.userId,
      actorType: 'USER',
      action: 'RECOVERY_APPROVED',
      entityType: 'TRANSACTION',
      entityId: txn.id,
      details: {
        actionType,
        amount: authoritativeAmount,
        providerReference: executionResult.providerReference,
        status: executionResult.status,
      },
    });

    return NextResponse.json({
      success: executionResult.success,
      result: executionResult,
    });
  } catch (error: any) {
    const statusCode = error?.statusCode || 500;
    return NextResponse.json(
      { success: false, error: error?.safeMessage || error?.message || 'Execution failed' },
      { status: statusCode }
    );
  }
}
