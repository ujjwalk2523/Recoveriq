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
import { WebhookDeliveryService } from '@/lib/webhooks/delivery-service';

export async function GET(req: NextRequest) {
  const requestId = resolveRequestId(req);

  try {
    const auth = await authenticateApiRequest(req);
    const hasReadScope =
      auth.scopes.includes(ApiScope.DEVELOPER_READ) || auth.scopes.includes(ApiScope.WEBHOOKS_READ);

    if (!hasReadScope) {
      requireScope(auth.scopes, ApiScope.DEVELOPER_READ);
    }

    const rateLimitHeaders = await ApiRateLimitService.assertRateLimit(auth.merchantId);
    const deadLetters = await WebhookDeliveryService.listDeadLetter(auth.merchantId, 50);

    return apiSuccess({ deadLetters }, auth.requestId, 200, rateLimitHeaders);
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    const code = err.code || ApiErrorCode.INTERNAL_ERROR;
    return apiErrorResponse(code, err.message, requestId, statusCode);
  }
}
