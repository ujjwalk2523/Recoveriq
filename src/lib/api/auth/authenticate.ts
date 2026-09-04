import { NextRequest } from 'next/server';
import { ApiKeyService } from './api-key-service';
import { ApiRequestContext } from './api-context';
import { ApiError, ApiErrorCode } from '../errors';
import { resolveRequestId } from '../request-id';

export async function authenticateApiRequest(req: NextRequest): Promise<ApiRequestContext> {
  const requestId = resolveRequestId(req);
  const authHeader = req.headers.get('authorization');

  if (!authHeader) {
    throw new ApiError(
      ApiErrorCode.INVALID_API_KEY,
      'Missing Authorization header. Expected Bearer <api_key>.',
      401,
      requestId
    );
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    throw new ApiError(
      ApiErrorCode.INVALID_API_KEY,
      'Malformed Authorization header. Format: Bearer <api_key>.',
      401,
      requestId
    );
  }

  const rawKey = parts[1];
  try {
    const verified = await ApiKeyService.verifyApiKey(rawKey);

    return {
      apiKeyId: verified.id,
      merchantId: verified.merchantId,
      environment: verified.environment,
      scopes: verified.scopes,
      name: verified.name,
      requestId,
    };
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw new ApiError(err.code, err.message, err.statusCode, requestId);
    }
    throw new ApiError(
      ApiErrorCode.INVALID_API_KEY,
      'Failed to authenticate API key.',
      401,
      requestId
    );
  }
}
