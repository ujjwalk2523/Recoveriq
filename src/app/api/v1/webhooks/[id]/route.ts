import { NextRequest } from 'next/server';
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
import { WebhookEndpointService } from '@/lib/webhooks/endpoint-service';
import { WebhookDeliveryService } from '@/lib/webhooks/delivery-service';
import { WebhookHealthCalculator } from '@/lib/webhooks/webhook-health';

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

    const hasReadScope =
      auth.scopes.includes(ApiScope.DEVELOPER_READ) || auth.scopes.includes(ApiScope.WEBHOOKS_READ);

    if (!hasReadScope) {
      requireScope(auth.scopes, ApiScope.DEVELOPER_READ);
    }

    const rateLimitHeaders = await ApiRateLimitService.assertRateLimit(auth.merchantId);
    const { id } = await params;

    const endpoint = await WebhookEndpointService.getEndpoint(id, auth.merchantId);
    if (!endpoint) {
      throw new ApiError(
        ApiErrorCode.RESOURCE_NOT_FOUND,
        `Webhook endpoint '${id}' not found for authenticated merchant.`,
        404,
        auth.requestId
      );
    }

    // Compute health metrics
    const recentDeliveries = await WebhookDeliveryService.listDeliveries(auth.merchantId, {
      endpointId: id,
      limit: 50,
    });
    const health = WebhookHealthCalculator.evaluateHealth(recentDeliveries);

    const latencyMs = Date.now() - startTime;
    ApiRequestLogger.logRequest({
      requestId: auth.requestId,
      merchantId: auth.merchantId,
      apiKeyId: auth.apiKeyId,
      environment: auth.environment,
      method: 'GET',
      path: `/api/v1/webhooks/${id}`,
      scope: ApiScope.DEVELOPER_READ,
      statusCode: 200,
      latencyMs,
    }).catch(() => {});

    return apiSuccess({ endpoint, health }, auth.requestId, 200, rateLimitHeaders);
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const statusCode = err.statusCode || 500;
    const code = err.code || ApiErrorCode.INTERNAL_ERROR;

    return apiErrorResponse(code, err.message, requestId, statusCode, err.headers || {});
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const requestId = resolveRequestId(req);

  try {
    const auth = await authenticateApiRequest(req);
    requireScope(auth.scopes, ApiScope.DEVELOPER_WRITE);
    const rateLimitHeaders = await ApiRateLimitService.assertRateLimit(auth.merchantId);

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const updated = await WebhookEndpointService.updateEndpoint(
      id,
      auth.merchantId,
      body,
      auth.name || 'API_KEY'
    );

    const latencyMs = Date.now() - startTime;
    ApiRequestLogger.logRequest({
      requestId: auth.requestId,
      merchantId: auth.merchantId,
      apiKeyId: auth.apiKeyId,
      environment: auth.environment,
      method: 'PATCH',
      path: `/api/v1/webhooks/${id}`,
      scope: ApiScope.DEVELOPER_WRITE,
      statusCode: 200,
      latencyMs,
    }).catch(() => {});

    return apiSuccess({ endpoint: updated }, auth.requestId, 200, rateLimitHeaders);
  } catch (err: any) {
    const statusCode = err.statusCode || 400;
    const code = err.code || ApiErrorCode.INVALID_REQUEST;
    return apiErrorResponse(code, err.message, requestId, statusCode, err.headers || {});
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const requestId = resolveRequestId(req);

  try {
    const auth = await authenticateApiRequest(req);
    requireScope(auth.scopes, ApiScope.DEVELOPER_WRITE);
    const rateLimitHeaders = await ApiRateLimitService.assertRateLimit(auth.merchantId);

    const { id } = await params;
    const deleted = await WebhookEndpointService.deleteEndpoint(id, auth.merchantId, auth.name || 'API_KEY');

    const latencyMs = Date.now() - startTime;
    ApiRequestLogger.logRequest({
      requestId: auth.requestId,
      merchantId: auth.merchantId,
      apiKeyId: auth.apiKeyId,
      environment: auth.environment,
      method: 'DELETE',
      path: `/api/v1/webhooks/${id}`,
      scope: ApiScope.DEVELOPER_WRITE,
      statusCode: 200,
      latencyMs,
    }).catch(() => {});

    return apiSuccess({ success: deleted, id }, auth.requestId, 200, rateLimitHeaders);
  } catch (err: any) {
    const statusCode = err.statusCode || 400;
    const code = err.code || ApiErrorCode.INVALID_REQUEST;
    return apiErrorResponse(code, err.message, requestId, statusCode, err.headers || {});
  }
}
