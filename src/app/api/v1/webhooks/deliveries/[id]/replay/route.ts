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
    const replayed = await WebhookDeliveryService.replayDelivery(
      id,
      auth.merchantId,
      auth.name || 'API_KEY'
    );

    return apiSuccess({ delivery: replayed }, auth.requestId, 200, rateLimitHeaders);
  } catch (err: any) {
    const statusCode = err.statusCode || 400;
    const code = err.code || ApiErrorCode.INVALID_REQUEST;
    return apiErrorResponse(code, err.message, requestId, statusCode);
  }
}
