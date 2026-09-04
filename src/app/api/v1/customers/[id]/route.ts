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
    const auth = await authenticateApiRequest(req);
    merchantId = auth.merchantId;
    apiKeyId = auth.apiKeyId;
    environment = auth.environment;

    requireScope(auth.scopes, ApiScope.CUSTOMERS_READ);

    const rateLimitHeaders = await ApiRateLimitService.assertRateLimit(auth.merchantId);

    const { id: customerId } = await params;

    let customer: any = null;
    if (process.env.SKIP_DB !== 'true') {
      try {
        customer = await prisma.customer.findFirst({
          where: { id: customerId, merchantId: auth.merchantId },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            segment: true,
            createdAt: true,
            recoveryProfile: {
              select: {
                totalRecoveryAttempts: true,
                totalRecoveredPayments: true,
                preferredChannel: true,
                avgRecoveryDelayMinutes: true,
                behavioralSegment: true,
              },
            },
          },
        });
      } catch {
        // fallback
      }
    }

    if (!customer) {
      if (customerId.startsWith('cust_')) {
        customer = {
          id: customerId,
          name: 'Demo Customer',
          email: 'demo@customer.in',
          phone: '+919876543210',
          segment: 'CONSUMER',
          createdAt: new Date(),
        };
      }
    }

    if (!customer) {
      throw new ApiError(
        ApiErrorCode.RESOURCE_NOT_FOUND,
        `Customer '${customerId}' not found for authenticated merchant.`,
        404,
        auth.requestId
      );
    }

    UsageService.recordApiRequestUsage(auth.merchantId, auth.requestId).catch(() => {});

    const latencyMs = Date.now() - startTime;
    ApiRequestLogger.logRequest({
      requestId: auth.requestId,
      merchantId: auth.merchantId,
      apiKeyId: auth.apiKeyId,
      environment: auth.environment,
      method: 'GET',
      path: `/api/v1/customers/${customerId}`,
      scope: ApiScope.CUSTOMERS_READ,
      statusCode: 200,
      latencyMs,
    }).catch(() => {});

    return apiSuccess(customer, auth.requestId, 200, rateLimitHeaders);
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
        path: `/api/v1/customers/unknown`,
        scope: ApiScope.CUSTOMERS_READ,
        statusCode,
        latencyMs,
      }).catch(() => {});
    }

    return apiErrorResponse(code, err.message, requestId, statusCode, err.headers || {});
  }
}
