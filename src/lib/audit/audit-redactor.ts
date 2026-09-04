/**
 * RecoverIQ — Deep Recursive Secret Redactor for Audit Ledger (Phase 8.7.1)
 */

const REDACTED_MARKER = '[REDACTED]';

// Case-insensitive regex patterns for sensitive keys
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /auth(orization)?/i,
  /cookie/i,
  /session/i,
  /private_?key/i,
  /api_?key/i,
  /mfa_?secret/i,
  /recovery_?codes?/i,
  /backup_?codes?/i,
  /client_?secret/i,
  /webhook_?secret/i,
  /payment_?token/i,
  /card_?number/i,
  /cvv/i,
  /cvc/i,
  /pan/i,
  /pin/i,
  /jwt/i,
  /credentials?/i,
  /hash$/i, // e.g. passwordHash, tokenHash (except eventHash/previousEventHash)
];

// Keys explicitly allowed even if matching a sensitive pattern
const ALLOWED_KEYS = new Set([
  'eventHash',
  'previousEventHash',
  'integrityHash',
  'ipHash',
  'tokenHash', // when tokenHash is explicitly stored as public identity hash if safe
  'sessionId',
  'requestId',
  'schemaVersion',
  'sequenceNumber',
]);

export class AuditRedactor {
  /**
   * Deeply and recursively scrubs all sensitive properties from any data structure.
   */
  static redact<T>(data: T): T {
    const seen = new WeakSet<object>();

    function redactValue(value: any, keyName?: string): any {
      if (value === null || value === undefined) {
        return value;
      }

      // Check key name if provided
      if (keyName && !ALLOWED_KEYS.has(keyName)) {
        for (const pattern of SENSITIVE_KEY_PATTERNS) {
          if (pattern.test(keyName)) {
            return REDACTED_MARKER;
          }
        }
      }

      // If string, check for common embedded secrets (e.g. Bearer tokens)
      if (typeof value === 'string') {
        // Redact authorization header format
        if (/^Bearer\s+[A-Za-z0-9\-_.]+/i.test(value.trim())) {
          return REDACTED_MARKER;
        }
        // Redact basic auth
        if (/^Basic\s+[A-Za-z0-9+/=]+/i.test(value.trim())) {
          return REDACTED_MARKER;
        }
        // Redact raw credit card patterns (13 to 19 digits)
        if (/^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{1,4}$/.test(value.trim())) {
          return REDACTED_MARKER;
        }
        return value;
      }

      // Primitives
      if (typeof value !== 'object') {
        return value;
      }

      // Date
      if (value instanceof Date) {
        return new Date(value.getTime());
      }

      // Detect circular references
      if (seen.has(value)) {
        return '[CIRCULAR]';
      }
      seen.add(value);

      // Arrays
      if (Array.isArray(value)) {
        return value.map(item => redactValue(item));
      }

      // Plain objects
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) {
        if (!ALLOWED_KEYS.has(k) && SENSITIVE_KEY_PATTERNS.some(p => p.test(k))) {
          result[k] = REDACTED_MARKER;
        } else {
          result[k] = redactValue(v, k);
        }
      }

      return result;
    }

    return redactValue(data);
  }
}
