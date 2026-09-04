import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  authenticateApiRequest,
  requireScope,
  ApiScope,
  ApiRateLimitService,
  ApiRequestLogger,
  ApiIdempotencyService,
  apiSuccess,
  apiErrorResponse,
  ApiError,
  ApiErrorCode,
  resolveRequestId,
} from '@/lib/api';
import { RecoveryIntelligenceEngine } from '@/lib/engine/recovery-intelligence';
import { RecoveryOrchestrator } from '@/lib/engine/sequence-orchestrator';
import { UsageService } from '@/lib/billing/usage-service';
import { IN_MEMORY_TRANSACTIONS } from '@/lib/razorpay/webhooks';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = resolveRequestId(req);
  let merchantId: string | null = null;
  let apiKeyId: string | null = null;
  let environment: any = 'TEST';
  let idempotencyKey: string | null = null;

  try {
    const auth = await authenticateApiRequest(req);
    merchantId = auth.merchantId;
    apiKeyId = auth.apiKeyId;
    environment = auth.environment;

    requireScope(auth.scopes, ApiScope.RECOVERY_EXECUTE);

    const rateLimitHeaders = await ApiRateLimitService.assertRateLimit(auth.merchantId);

    const body = await req.json().catch(() => ({}));
    const { transactionId } = body;

    if (!transactionId) {
      throw new ApiError(
        ApiErrorCode.INVALID_REQUEST,
        'Missing required field: transactionId.',
        400,
        auth.requestId
      );
    }

    // Idempotency check
    idempotencyKey = req.headers.get('idempotency-key');
    if (idempotencyKey) {
      const requestHash = ApiIdempotencyService.hashRequest('POST', '/api/v1/recovery/execute', body);
      const idempResult = await ApiIdempotencyService.checkOrReserve(
        auth.merchantId,
        idempotencyKey,
        requestHash,
        auth.apiKeyId
      );

      if (idempResult.isCached) {
        return NextResponse.json(idempResult.cachedResponse, {
          status: idempResult.cachedStatus || 200,
          headers: {
            'x-request-id': auth.requestId,
            'idempotent-replayed': 'true',
            ...rateLimitHeaders,
          },
        });
      }
    }

    // Verify transaction strictly scoped to merchant
    let txn: any = null;
    if (process.env.SKIP_DB !== 'true') {
      try {
        txn = await prisma.transaction.findFirst({
          where: { id: transactionId, merchantId: auth.merchantId },
          include: { customer: true },
        });
      } catch {
        // fallback
      }
    }

    if (!txn) {
      const memTxn = IN_MEMORY_TRANSACTIONS.get(transactionId);
      if (memTxn && memTxn.merchantId === auth.merchantId) {
        txn = memTxn;
      }
    }

    if (!txn) {
      throw new ApiError(
        ApiErrorCode.RESOURCE_NOT_FOUND,
        `Transaction '${transactionId}' not found for authenticated merchant.`,
        404,
        auth.requestId
      );
    }

    // Run Recovery Intelligence and Policy Check
    const intelligence = RecoveryIntelligenceEngine.process({
      amount: txn.amount || 1000,
      paymentMethod: (txn.paymentMethod as any) || 'CARD',
      failureCode: txn.failureCode || 'GATEWAY_ERROR',
      failureMessage: txn.failureMessage || 'Payment failed',
      customer: txn.customer || {
        id: txn.customerId || 'cust_default',
        name: 'Merchant Customer',
        email: 'customer@example.com',
        phone: '+919876543210',
        segment: 'CONSUMER',
        lifetimeValue: txn.amount * 2 || 2000,
        totalTransactions: 1,
        pastRecoveries: 0,
        fatigueScore: 10,
        riskScore: 10,
      },
      attemptNumber: 1,
    });

    let sequenceResult: any = null;
    const executionStatus = intelligence.isAutoApproved ? 'DISPATCHED' : 'PENDING_APPROVAL';

    if (intelligence.isAutoApproved && intelligence.recommendedAction !== 'DO_NOT_RECOVER') {
      // Execute through Phase 4 Sequence & Phase 5 Worker queue
      try {
        sequenceResult = await RecoveryOrchestrator.startSequence({
          transactionId: txn.id,
          merchantId: auth.merchantId,
          failureCategory: (txn.failureCategory as any) || 'HARD_DECLINE',
          customer: {
            id: txn.customerId || 'cust_default',
            name: txn.customer?.name || 'Customer',
            email: txn.customer?.email || 'customer@example.com',
            phone: txn.customer?.phone || '+919876543210',
            segment: txn.customer?.segment || 'CONSUMER',
            lifetimeValue: (txn.amount || 1000) * 2,
            totalTransactions: 1,
            pastRecoveries: 0,
            fatigueScore: 10,
            riskScore: 10,
          },
          amount: txn.amount || 1000,
          policyCheck: intelligence.policyCheck,
          isAutoApproved: intelligence.isAutoApproved,
        });
      } catch {
        // sequence initialization handled
      }
    }

    const responsePayload = {
      transactionId,
      status: executionStatus,
      sequenceId: sequenceResult?.sequenceId || null,
      executionChannel: intelligence.recommendedAction,
      requiresApproval: !intelligence.isAutoApproved,
      approvalReason: intelligence.isAutoApproved ? null : intelligence.approvalReason,
      confidence: intelligence.confidenceScore,
      expectedNetRecovery: intelligence.expectedNetRecoveryINR,
    };

    // Finalize idempotency if key was provided
    if (idempotencyKey) {
      ApiIdempotencyService.finalize(
        auth.merchantId,
        idempotencyKey,
        200,
        { requestId: auth.requestId, data: responsePayload }
      ).catch(() => {});
    }

    UsageService.recordApiRequestUsage(auth.merchantId, auth.requestId).catch(() => {});

    const latencyMs = Date.now() - startTime;
    ApiRequestLogger.logRequest({
      requestId: auth.requestId,
      merchantId: auth.merchantId,
      apiKeyId: auth.apiKeyId,
      environment: auth.environment,
      method: 'POST',
      path: '/api/v1/recovery/execute',
      scope: ApiScope.RECOVERY_EXECUTE,
      statusCode: 200,
      latencyMs,
      idempotencyKey,
    }).catch(() => {});

    return apiSuccess(responsePayload, auth.requestId, 200, rateLimitHeaders);
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const statusCode = err.statusCode || 500;
    const code = err.code || ApiErrorCode.INTERNAL_ERROR;

    if (merchantId) {
      ApiRequestLogger.logRequest({
        requestId,
        merchantId,
        apiKeyId,
        environment,
        method: 'POST',
        path: '/api/v1/recovery/execute',
        scope: ApiScope.RECOVERY_EXECUTE,
        statusCode,
        latencyMs,
        idempotencyKey,
      }).catch(() => {});
    }

    return apiErrorResponse(code, err.message, requestId, statusCode, err.headers || {});
  }
}
