import { AsyncLocalStorage } from 'async_hooks';
import crypto from 'crypto';

export interface RequestContext {
  requestId: string;
  merchantId?: string;
  actor?: string;
  startTime: number;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Generates a cryptographically random, sanitized request ID.
 */
export function createRequestId(): string {
  return `req_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

/**
 * Sanitizes and preserves a client-provided X-Request-ID if valid,
 * or safely generates a new one if missing or malformed.
 */
export function resolveRequestId(incomingHeader?: string | null): string {
  if (incomingHeader && typeof incomingHeader === 'string') {
    const trimmed = incomingHeader.trim();
    // Allow alphanumeric, dashes, underscores, up to 64 chars
    if (/^[a-zA-Z0-9_-]{8,64}$/.test(trimmed)) {
      return trimmed;
    }
  }
  return createRequestId();
}

/**
 * Wraps execution within an active AsyncLocalStorage request context.
 */
export function withRequestContext<T>(
  context: Partial<RequestContext> & { requestId?: string },
  fn: () => T
): T {
  const fullContext: RequestContext = {
    requestId: context.requestId || createRequestId(),
    merchantId: context.merchantId,
    actor: context.actor,
    startTime: context.startTime || Date.now(),
  };

  return asyncLocalStorage.run(fullContext, fn);
}

/**
 * Retrieves the current request context if available.
 */
export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Returns the current request ID from AsyncLocalStorage or generates a fallback.
 */
export function getRequestId(): string {
  const store = asyncLocalStorage.getStore();
  return store?.requestId || 'req_system_standalone';
}
