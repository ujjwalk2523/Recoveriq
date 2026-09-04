import { ApplicationError } from '@/lib/errors/application-error';

export class InputValidationError extends ApplicationError {
  constructor(message: string) {
    super({
      code: 'INVALID_INPUT',
      message,
      statusCode: 400,
      safeMessage: 'Invalid request parameter.',
    });
  }
}

export class SsrfSecurityViolationError extends ApplicationError {
  constructor(message: string) {
    super({
      code: 'SSRF_SECURITY_VIOLATION',
      message,
      statusCode: 400,
      safeMessage: 'Invalid destination URL: destination rejected for security.',
    });
  }
}

/**
 * Validates external URLs to protect against Server-Side Request Forgery (SSRF).
 * Rejects private networks, loopback addresses, cloud metadata endpoints, and non-HTTPS protocols.
 */
export function validateSafeUrl(rawUrl: string, allowHttpInDev = false): { valid: boolean; reason?: string } {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, reason: 'URL must be a non-empty string.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { valid: false, reason: 'Malformed URL.' };
  }

  // Protocol check: HTTPS required in production
  if (parsed.protocol !== 'https:') {
    if (parsed.protocol === 'http:' && allowHttpInDev && process.env.APP_ENV !== 'production') {
      // Allowed in development for internal mock tests
    } else {
      return {
        valid: false,
        reason: `Invalid protocol '${parsed.protocol}'. Only HTTPS is permitted.`,
      };
    }
  }

  const hostname = parsed.hostname.toLowerCase().trim();

  // 1. Known Loopback and Metadata hostnames
  const BLOCKED_HOSTNAMES = [
    'localhost',
    'localhost.localdomain',
    'metadata.google.internal',
    'instance-data',
    'metadata',
  ];

  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { valid: false, reason: `Destination '${hostname}' is a forbidden internal host.` };
  }

  // 2. IP Address Validation (prevent private and link-local ranges)
  // IPv4 regex
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1, 5).map(Number);
    const [o1, o2, o3, o4] = octets;

    // Check invalid octets
    if (octets.some((o) => o < 0 || o > 255)) {
      return { valid: false, reason: 'Invalid IP address.' };
    }

    // Loopback: 127.0.0.0/8
    if (o1 === 127) {
      return { valid: false, reason: 'Loopback IPv4 addresses are prohibited.' };
    }

    // 0.0.0.0/8
    if (o1 === 0) {
      return { valid: false, reason: 'Zero-network IPv4 addresses are prohibited.' };
    }

    // Private IPv4: 10.0.0.0/8
    if (o1 === 10) {
      return { valid: false, reason: 'Private network (10.0.0.0/8) is prohibited.' };
    }

    // Private IPv4: 172.16.0.0/12 (172.16.x.x - 172.31.x.x)
    if (o1 === 172 && o2 >= 16 && o2 <= 31) {
      return { valid: false, reason: 'Private network (172.16.0.0/12) is prohibited.' };
    }

    // Private IPv4: 192.168.0.0/16
    if (o1 === 192 && o2 === 168) {
      return { valid: false, reason: 'Private network (192.168.0.0/16) is prohibited.' };
    }

    // Link-Local / Cloud Metadata: 169.254.0.0/16 (e.g. 169.254.169.254)
    if (o1 === 169 && o2 === 254) {
      return { valid: false, reason: 'Link-local / cloud metadata address (169.254.0.0/16) is prohibited.' };
    }
  }

  // 3. IPv6 Validation
  if (hostname === '::1' || hostname === '[::1]' || hostname.startsWith('fe80:') || hostname.startsWith('fc00:')) {
    return { valid: false, reason: 'IPv6 loopback and unique local addresses are prohibited.' };
  }

  return { valid: true };
}

/**
 * Asserts that a URL is safe or throws SsrfSecurityViolationError.
 */
export function assertSafeUrl(rawUrl: string, allowHttpInDev = false): string {
  const result = validateSafeUrl(rawUrl, allowHttpInDev);
  if (!result.valid) {
    throw new SsrfSecurityViolationError(result.reason || 'SSRF violation detected.');
  }
  return rawUrl;
}

/**
 * Validates that an amount is a non-negative integer representing minor currency units (paise).
 * Prevents floating point errors, NaN, Infinity, negative values, and integer overflows.
 */
export function validateIntegerPaise(value: any, fieldName = 'amount'): number {
  if (typeof value !== 'number') {
    throw new InputValidationError(`Field '${fieldName}' must be a number.`);
  }

  if (isNaN(value) || !isFinite(value)) {
    throw new InputValidationError(`Field '${fieldName}' must be a finite number.`);
  }

  if (!Number.isInteger(value)) {
    throw new InputValidationError(`Field '${fieldName}' must be an integer minor unit (paise). Floating-point values are rejected.`);
  }

  if (value < 0) {
    throw new InputValidationError(`Field '${fieldName}' cannot be negative.`);
  }

  // Maximum single transaction ceiling: ₹10,000,000 (1 billion paise)
  const MAX_PAISE = 1_000_000_000;
  if (value > MAX_PAISE) {
    throw new InputValidationError(`Field '${fieldName}' exceeds maximum transaction limit of ₹10,000,000.`);
  }

  return value;
}

/**
 * Escapes HTML characters to prevent Cross-Site Scripting (XSS).
 */
export function escapeHtml(str?: string | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitizes plain text by removing null bytes and control characters.
 */
export function sanitizePlainText(str?: string | null, maxLen = 1000): string {
  if (!str) return '';
  // Remove null bytes and non-printable control characters
  const cleaned = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
  return cleaned.slice(0, maxLen);
}

/**
 * Validates standard UUID v4 format.
 */
export function validateUuid(id?: string | null): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}
