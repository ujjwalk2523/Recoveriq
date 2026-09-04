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

export async function GET(req: NextRequest) {
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

    // Accepts developer:read or webhooks:read
    const hasReadScope =
      auth.scopes.includes(ApiScope.DEVELOPER_READ) || auth.scopes.includes(ApiScope.WEBHOOKS_READ);

    if (!hasReadScope) {
      requireScope(auth.scopes, ApiScope.DEVELOPER_READ);
    }

    const rateLimitHeaders = await ApiRateLimitService.assertRateLimit(auth.merchantId);
    const endpoints = await WebhookEndpointService.listEndpoints(auth.merchantId);

    const latencyMs = Date.now() - startTime;
    ApiRequestLogger.logRequest({
      requestId: auth.requestId,
      merchantId: auth.merchantId,
      apiKeyId: auth.apiKeyId,
      environment: auth.environment,
      method: 'GET',
      path: '/api/v1/webhooks',
      scope: ApiScope.DEVELOPER_READ,
      statusCode: 200,
      latencyMs,
    }).catch(() => {});

    return apiSuccess({ endpoints }, auth.requestId, 200, rateLimitHeaders);
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
        path: '/api/v1/webhooks',
        scope: ApiScope.DEVELOPER_READ,
        statusCode,
        latencyMs,
      }).catch(() => {});
    }

    return apiErrorResponse(code, err.message, requestId, statusCode, err.headers || {});
  }
}

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

    requireScope(auth.scopes, ApiScope.DEVELOPER_WRITE);

    const rateLimitHeaders = await ApiRateLimitService.assertRateLimit(auth.merchantId);
    const body = await req.json().catch(() => ({}));
    const { url, description, subscribedEvents } = body;

    if (!url || !subscribedEvents) {
      throw new ApiError(
        ApiErrorCode.INVALID_REQUEST,
        'Fields `url` and `subscribedEvents` are required.',
        400,
        auth.requestId
      );
    }

    const result = await WebhookEndpointService.createEndpoint({
      merchantId: auth.merchantId,
      url,
      description,
      subscribedEvents,
      createdBy: auth.name || 'API_KEY',
    });

    const latencyMs = Date.now() - startTime;
    ApiRequestLogger.logRequest({
      requestId: auth.requestId,
      merchantId: auth.merchantId,
      apiKeyId: auth.apiKeyId,
      environment: auth.environment,
      method: 'POST',
      path: '/api/v1/webhooks',
      scope: ApiScope.DEVELOPER_WRITE,
      statusCode: 201,
      latencyMs,
    }).catch(() => {});

    return apiSuccess(
      {
        endpoint: result.endpoint,
        secret: result.rawSecret,
        warning: 'Store this webhook secret securely. It will never be shown again.',
      },
      auth.requestId,
      201,
      rateLimitHeaders
    );
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const statusCode = err.statusCode || 400;
    const code = err.code || ApiErrorCode.INVALID_REQUEST;

    if (merchantId) {
      ApiRequestLogger.logRequest({
        requestId,
        merchantId,
        apiKeyId,
        environment,
        method: 'POST',
        path: '/api/v1/webhooks',
        scope: ApiScope.DEVELOPER_WRITE,
        statusCode,
        latencyMs,
      }).catch(() => {});
    }

    return apiErrorResponse(code, err.message, requestId, statusCode, err.headers || {});
  }
}
