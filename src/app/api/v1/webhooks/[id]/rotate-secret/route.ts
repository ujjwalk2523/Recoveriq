import { NextRequest } from 'next/server';
import {
  authenticateApiRequest,
  requireScope,
  ApiScope,
  ApiRateLimitService,
  apiSuccess,
  apiErrorResponse,
  ApiErrorCode,
  resolveRequestId,
} from '@/lib/api';
import { WebhookEndpointService } from '@/lib/webhooks/endpoint-service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = resolveRequestId(req);

  try {
    const auth = await authenticateApiRequest(req);
    requireScope(auth.scopes, ApiScope.DEVELOPER_WRITE);
    const rateLimitHeaders = await ApiRateLimitService.assertRateLimit(auth.merchantId);

    const { id } = await params;
    const result = await WebhookEndpointService.rotateSecret(id, auth.merchantId, auth.name || 'API_KEY');

    return apiSuccess(
      {
        endpoint: result.endpoint,
        secret: result.newRawSecret,
        warning: 'Store this replacement webhook secret securely. It will never be shown again.',
      },
      auth.requestId,
      200,
      rateLimitHeaders
    );
  } catch (err: any) {
    const statusCode = err.statusCode || 400;
    const code = err.code || ApiErrorCode.INVALID_REQUEST;
    return apiErrorResponse(code, err.message, requestId, statusCode);
  }
}
