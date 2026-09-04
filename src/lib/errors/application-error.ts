import { getRequestId } from '../observability/request-context';
import { isProduction } from '../config/environment';

export interface SafeErrorPayload {
  error: {
    code: string;
    message: string;
    requestId?: string;
    metadata?: Record<string, any>;
  };
}

export class ApplicationError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly safeMessage: string;
  readonly metadata?: Record<string, any>;

  constructor(options: {
    code: string;
    message: string;
    statusCode?: number;
    safeMessage?: string;
    metadata?: Record<string, any>;
  }) {
    super(options.message);
    this.name = 'ApplicationError';
    this.code = options.code;
    this.statusCode = options.statusCode || 500;
    this.safeMessage = options.safeMessage || 'An unexpected operational error occurred.';
    this.metadata = options.metadata;

    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Produces a sanitized, production-safe response payload.
   * Internal stack traces, raw SQL queries, and filesystem paths are never exposed.
   */
  toSafeResponse(): SafeErrorPayload {
    return {
      error: {
        code: this.code,
        message: this.safeMessage,
        requestId: getRequestId(),
        ...(!isProduction() ? { metadata: this.metadata } : {}),
      },
    };
  }
}

export class DatabaseUnavailableError extends ApplicationError {
  constructor(details = 'Database connection ping failed or timed out') {
    super({
      code: 'DATABASE_UNAVAILABLE',
      message: details,
      statusCode: 503,
      safeMessage: 'Database service is temporarily unavailable. Please try again shortly.',
    });
  }
}

export class ConfigurationError extends ApplicationError {
  constructor(message: string) {
    super({
      code: 'CONFIGURATION_ERROR',
      message,
      statusCode: 500,
      safeMessage: 'System configuration error detected.',
    });
  }
}

export class UnauthorizedError extends ApplicationError {
  constructor(message = 'Authentication required') {
    super({
      code: 'UNAUTHORIZED',
      message,
      statusCode: 401,
      safeMessage: 'Authentication required to perform this action.',
    });
  }
}

export class ForbiddenError extends ApplicationError {
  constructor(message = 'Access forbidden') {
    super({
      code: 'FORBIDDEN',
      message,
      statusCode: 403,
      safeMessage: 'You do not have permission to access this resource.',
    });
  }
}

export class NotFoundError extends ApplicationError {
  constructor(resource: string, identifier?: string) {
    super({
      code: 'RESOURCE_NOT_FOUND',
      message: identifier ? `${resource} '${identifier}' not found.` : `${resource} not found.`,
      statusCode: 404,
      safeMessage: `${resource} not found.`,
    });
  }
}
