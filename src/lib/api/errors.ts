export enum ApiErrorCode {
  INVALID_API_KEY = 'INVALID_API_KEY',
  REVOKED_API_KEY = 'REVOKED_API_KEY',
  EXPIRED_API_KEY = 'EXPIRED_API_KEY',
  INVALID_ENVIRONMENT = 'INVALID_ENVIRONMENT',
  INSUFFICIENT_SCOPE = 'INSUFFICIENT_SCOPE',
  INVALID_REQUEST = 'INVALID_REQUEST',
  IDEMPOTENCY_CONFLICT = 'IDEMPOTENCY_CONFLICT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  TENANT_ACCESS_DENIED = 'TENANT_ACCESS_DENIED',
  FEATURE_NOT_AVAILABLE = 'FEATURE_NOT_AVAILABLE',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export class ApiError extends Error {
  public readonly code: ApiErrorCode;
  public readonly statusCode: number;
  public readonly requestId?: string;

  constructor(code: ApiErrorCode, message: string, statusCode = 400, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.requestId = requestId;
  }
}

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId: string;
  };
}

export function formatApiError(
  code: ApiErrorCode,
  message: string,
  requestId: string
): ApiErrorResponse {
  return {
    error: {
      code,
      message,
      requestId,
    },
  };
}
