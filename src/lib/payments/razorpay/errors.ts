import { PaymentProviderErrorCode, ErrorClassification } from './types';

export class PaymentProviderError extends Error {
  public readonly code: PaymentProviderErrorCode;
  public readonly classification: ErrorClassification;
  public readonly statusCode?: number;
  public readonly providerRequestId?: string;
  public readonly rawError?: any;

  constructor(params: {
    message: string;
    code: PaymentProviderErrorCode;
    classification: ErrorClassification;
    statusCode?: number;
    providerRequestId?: string;
    rawError?: any;
  }) {
    super(params.message);
    this.name = 'PaymentProviderError';
    this.code = params.code;
    this.classification = params.classification;
    this.statusCode = params.statusCode;
    this.providerRequestId = params.providerRequestId;
    this.rawError = params.rawError;
  }
}

/**
 * Normalizes any unknown Razorpay/HTTP error into a strongly typed PaymentProviderError.
 */
export function normalizeRazorpayError(err: any, statusCode?: number): PaymentProviderError {
  const status = statusCode || err?.status || err?.statusCode || 500;
  const message = err?.error?.description || err?.message || 'Unknown payment provider failure';
  const providerRequestId = err?.error?.metadata?.payment_id || err?.headers?.['x-razorpay-request-id'];

  // 1. Authentication failure
  if (status === 401 || err?.error?.code === 'BAD_REQUEST_ERROR' && message.includes('auth')) {
    return new PaymentProviderError({
      message: 'Razorpay provider authentication failed. Check credentials.',
      code: 'AUTHENTICATION_FAILED',
      classification: 'AUTHENTICATION_FAILED',
      statusCode: 401,
      providerRequestId,
      rawError: err,
    });
  }

  // 2. Rate limiting
  if (status === 429) {
    return new PaymentProviderError({
      message: 'Razorpay API rate limit exceeded.',
      code: 'RATE_LIMITED',
      classification: 'TRANSIENT',
      statusCode: 429,
      providerRequestId,
      rawError: err,
    });
  }

  // 3. Network timeout or provider unavailable
  if (status === 503 || status === 504 || status === 502 || err?.code === 'ECONNRESET' || err?.code === 'ETIMEDOUT') {
    return new PaymentProviderError({
      message: `Razorpay provider service unavailable (${status}).`,
      code: 'PROVIDER_UNAVAILABLE',
      classification: 'TRANSIENT',
      statusCode: status,
      providerRequestId,
      rawError: err,
    });
  }

  // 4. Server 500
  if (status >= 500) {
    return new PaymentProviderError({
      message: `Razorpay internal gateway error (${status}).`,
      code: 'PROVIDER_UNAVAILABLE',
      classification: 'TRANSIENT',
      statusCode: status,
      providerRequestId,
      rawError: err,
    });
  }

  // 5. Payment not found
  if (status === 404) {
    return new PaymentProviderError({
      message: 'Payment or order entity not found on Razorpay.',
      code: 'PAYMENT_NOT_FOUND',
      classification: 'PERMANENT',
      statusCode: 404,
      providerRequestId,
      rawError: err,
    });
  }

  // 6. Bad Request / Invalid parameters
  if (status === 400) {
    return new PaymentProviderError({
      message: `Invalid Razorpay request: ${message}`,
      code: 'INVALID_REQUEST',
      classification: 'PERMANENT',
      statusCode: 400,
      providerRequestId,
      rawError: err,
    });
  }

  // Default
  return new PaymentProviderError({
    message,
    code: 'UNKNOWN_PROVIDER_ERROR',
    classification: 'PERMANENT',
    statusCode: status,
    providerRequestId,
    rawError: err,
  });
}
