import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  authenticateApiRequest,
  requireScope,
  ApiScope,
  ApiRateLimitService,
  ApiRequestLogger,
  apiSuccess,
  apiErrorResponse,
  ApiError,
  ApiErrorCode,
  resolveRequestId,
} from '@/lib/api';
import { RecoveryIntelligenceEngine } from '@/lib/engine/recovery-intelligence';
import { UsageService } from '@/lib/billing/usage-service';
import { IN_MEMORY_TRANSACTIONS } from '@/lib/razorpay/webhooks';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = resolveRequestId(req);
  let merchantId: string | null = null;
  let apiKeyId: string | null = null;
  let environment: any = 'TEST';

  try {
    const auth = await authenticateApiRequest(req);
    merchantId = auth.merchantId;
    apiKeyId = auth.apiKeyId;
    environment = auth.environment;

    requireScope(auth.scopes, ApiScope.RECOVERY_READ);

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

    // Tenant lookup
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

    // Call existing Recovery Intelligence Engine
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

    UsageService.recordApiRequestUsage(auth.merchantId, auth.requestId).catch(() => {});

    const latencyMs = Date.now() - startTime;
    ApiRequestLogger.logRequest({
      requestId: auth.requestId,
      merchantId: auth.merchantId,
      apiKeyId: auth.apiKeyId,
      environment: auth.environment,
      method: 'POST',
      path: '/api/v1/recovery/evaluate',
      scope: ApiScope.RECOVERY_READ,
      statusCode: 200,
      latencyMs,
    }).catch(() => {});

    return apiSuccess(
      {
        transactionId,
        decision: intelligence.recommendedAction,
        confidence: intelligence.confidenceScore,
        expectedNetRecovery: intelligence.expectedNetRecoveryINR,
        recommendedTiming: intelligence.customerMemory?.avgRecoveryDelayMinutes ?? 15,
        strategy: intelligence.recommendedAction,
        decisionSource: intelligence.isAutoApproved ? 'AUTONOMOUS_POLICY' : 'MANUAL_APPROVAL_REQUIRED',
      },
      auth.requestId,
      200,
      rateLimitHeaders
    );
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
        path: '/api/v1/recovery/evaluate',
        scope: ApiScope.RECOVERY_READ,
        statusCode,
        latencyMs,
      }).catch(() => {});
    }

    return apiErrorResponse(code, err.message, requestId, statusCode, err.headers || {});
  }
}
