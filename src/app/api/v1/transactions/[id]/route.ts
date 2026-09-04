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
import { UsageService } from '@/lib/billing/usage-service';
import { IN_MEMORY_TRANSACTIONS } from '@/lib/razorpay/webhooks';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const requestId = resolveRequestId(req);
  let merchantId: string | null = null;
  let apiKeyId: string | null = null;
  let environment: any = 'TEST';

  try {
    // 1. Authenticate API Key
    const auth = await authenticateApiRequest(req);
    merchantId = auth.merchantId;
    apiKeyId = auth.apiKeyId;
    environment = auth.environment;

    // 2. Scope Authorization
    requireScope(auth.scopes, ApiScope.TRANSACTIONS_READ);

    // 3. Rate Limiting
    const rateLimitHeaders = await ApiRateLimitService.assertRateLimit(auth.merchantId);

    // 4. Resolve Params
    const { id: transactionId } = await params;

    // 5. Look up Transaction strictly scoped to authenticated merchant
    let transaction: any = null;

    if (process.env.SKIP_DB !== 'true') {
      try {
        transaction = await prisma.transaction.findFirst({
          where: {
            id: transactionId,
            merchantId: auth.merchantId, // Strict tenant isolation
          },
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                segment: true,
              },
            },
            recoveryAttempts: {
              select: {
                id: true,
                attemptNumber: true,
                actionType: true,
                channel: true,
                status: true,
                createdAt: true,
              },
            },
          },
        });
      } catch {
        // fallback
      }
    }

    if (!transaction) {
      // Check in-memory mock store
      const memTxn = IN_MEMORY_TRANSACTIONS.get(transactionId);
      if (memTxn && memTxn.merchantId === auth.merchantId) {
        transaction = {
          id: memTxn.id,
          merchantId: memTxn.merchantId,
          orderId: memTxn.orderId,
          paymentId: memTxn.paymentId,
          amount: memTxn.amount,
          currency: memTxn.currency,
          paymentMethod: memTxn.paymentMethod,
          status: memTxn.status,
          failureCategory: memTxn.failureCategory,
          createdAt: memTxn.createdAt,
        };
      }
    }

    if (!transaction) {
      throw new ApiError(
        ApiErrorCode.RESOURCE_NOT_FOUND,
        `Transaction '${transactionId}' not found for authenticated merchant.`,
        404,
        auth.requestId
      );
    }

    // 6. Meter API Request Usage (Phase 7.2)
    UsageService.recordApiRequestUsage(auth.merchantId, auth.requestId).catch(() => {});

    // 7. Log API Request for Observability
    const latencyMs = Date.now() - startTime;
    ApiRequestLogger.logRequest({
      requestId: auth.requestId,
      merchantId: auth.merchantId,
      apiKeyId: auth.apiKeyId,
      environment: auth.environment,
      method: 'GET',
      path: `/api/v1/transactions/${transactionId}`,
      scope: ApiScope.TRANSACTIONS_READ,
      statusCode: 200,
      latencyMs,
    }).catch(() => {});

    return apiSuccess(transaction, auth.requestId, 200, rateLimitHeaders);
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
        method: 'GET',
        path: `/api/v1/transactions/unknown`,
        scope: ApiScope.TRANSACTIONS_READ,
        statusCode,
        latencyMs,
      }).catch(() => {});
    }

    return apiErrorResponse(code, err.message, requestId, statusCode, err.headers || {});
  }
}
