import { getRequestId } from './request-context';
import { getRuntimeEnvironment } from '../config/environment';
import { SERVICE_NAME } from '../config/version';
import { getEnvConfig } from '../config/env';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
};

export interface LogContext {
  merchantId?: string;
  transactionId?: string;
  sequenceId?: string;
  recoveryAttemptId?: string;
  webhookEventId?: string;
  apiKeyId?: string;
  provider?: string;
  action?: string;
  durationMs?: number;
  errorCode?: string;
  [key: string]: any;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  environment: string;
  requestId: string;
  message: string;
  [key: string]: any;
}

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /cookie/i,
  /set-cookie/i,
  /api[_-]?key/i,
  /whsec/i,
  /signature/i,
  /card/i,
  /cvv/i,
  /pan/i,
  /credential/i,
  /private[_-]?key/i,
  /database[_-]?url/i,
  /redis[_-]?url/i,
  /connection[_-]?string/i,
];

/**
 * Redacts a single secret string with masking.
 */
export function redactSecret(secret?: string | null): string {
  if (!secret || typeof secret !== 'string') return '[REDACTED]';
  if (secret.length <= 8) return '••••••••';
  return `${secret.slice(0, 4)}••••••••${secret.slice(-4)}`;
}

/**
 * Redacts an HTTP Authorization header (e.g. Bearer or Basic tokens).
 */
export function redactAuthorizationHeader(header?: string | null): string {
  if (!header || typeof header !== 'string') return '[REDACTED]';
  const parts = header.trim().split(' ');
  if (parts.length === 2) {
    return `${parts[0]} ${redactSecret(parts[1])}`;
  }
  return redactSecret(header);
}

/**
 * Deeply clones and redacts sensitive properties from objects or arrays.
 */
export function redactSensitiveObject<T>(target: T): T {
  if (target === null || target === undefined) return target;

  if (typeof target === 'string') {
    // Check if looks like a bearer token or secret
    if (target.startsWith('Bearer ') || target.startsWith('Basic ')) {
      return redactAuthorizationHeader(target) as unknown as T;
    }
    if (target.startsWith('whsec_') || target.startsWith('rk_') || target.startsWith('rzp_') || target.startsWith('rcvq_')) {
      return redactSecret(target) as unknown as T;
    }
    if (target.startsWith('postgres://') || target.startsWith('postgresql://') || target.startsWith('redis://') || target.startsWith('rediss://')) {
      return redactSecret(target) as unknown as T;
    }
    return target;
  }

  if (Array.isArray(target)) {
    return target.map((item) => redactSensitiveObject(item)) as unknown as T;
  }

  if (typeof target === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(target as Record<string, any>)) {
      const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));

      if (isSensitiveKey) {
        if (typeof value === 'string') {
          sanitized[key] = redactSecret(value);
        } else {
          sanitized[key] = '[REDACTED]';
        }
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = redactSensitiveObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized as T;
  }

  return target;
}

export class Logger {
  private static shouldLog(level: LogLevel): boolean {
    const configuredLevel = getEnvConfig().LOG_LEVEL;
    const currentPriority = LOG_LEVEL_PRIORITY[level] ?? 20;
    const configuredPriority = LOG_LEVEL_PRIORITY[configuredLevel] ?? 20;
    return currentPriority >= configuredPriority;
  }

  private static formatLog(level: LogLevel, message: string, context?: LogContext): StructuredLogEntry {
    const sanitizedContext = context ? redactSensitiveObject(context) : {};

    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: SERVICE_NAME,
      environment: getRuntimeEnvironment(),
      requestId: getRequestId(),
      message,
      ...sanitizedContext,
    };

    return entry;
  }

  static debug(message: string, context?: LogContext): void {
    if (!this.shouldLog('DEBUG')) return;
    const formatted = this.formatLog('DEBUG', message, context);
    console.debug(JSON.stringify(formatted));
  }

  static info(message: string, context?: LogContext): void {
    if (!this.shouldLog('INFO')) return;
    const formatted = this.formatLog('INFO', message, context);
    console.log(JSON.stringify(formatted));
  }

  static warn(message: string, context?: LogContext): void {
    if (!this.shouldLog('WARN')) return;
    const formatted = this.formatLog('WARN', message, context);
    console.warn(JSON.stringify(formatted));
  }

  static error(message: string, context?: LogContext): void {
    if (!this.shouldLog('ERROR')) return;
    const formatted = this.formatLog('ERROR', message, context);
    console.error(JSON.stringify(formatted));
  }
}

export const logger = Logger;
