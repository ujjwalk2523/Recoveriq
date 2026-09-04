import { ApplicationError } from '../errors/application-error';

export const RESERVED_ORGANIZATION_SLUGS = new Set([
  'admin',
  'api',
  'login',
  'logout',
  'settings',
  'billing',
  'support',
  'security',
  'system',
  'dashboard',
  'app',
  'www',
  'auth',
  'recoveriq',
  'webhook',
  'webhooks',
  'worker',
  'workers',
  'ready',
  'health',
  'diagnostics',
  'analytics',
  'simulator',
  'experiments',
  'transactions',
  'signup',
  'register',
]);

export const ORGANIZATION_POLICY = {
  slug: {
    minLength: 3,
    maxLength: 48,
    pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  },
  invitation: {
    ttlDays: 7,
    ttlSeconds: 7 * 24 * 60 * 60,
  },
  teams: {
    minNameLength: 2,
    maxNameLength: 64,
  },
};

/**
 * Normalizes an organization slug:
 * - Trims whitespace
 * - Converts to lowercase
 * - Replaces non-alphanumerics with hyphens
 * - Removes leading/trailing hyphens and collapses consecutive hyphens
 */
export function normalizeSlug(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Validates whether a slug conforms to format, length, and reserved name constraints.
 */
export function validateSlug(raw: string): { valid: boolean; normalized: string; error?: string } {
  const normalized = normalizeSlug(raw);

  if (normalized.length < ORGANIZATION_POLICY.slug.minLength) {
    return {
      valid: false,
      normalized,
      error: `Slug must be at least ${ORGANIZATION_POLICY.slug.minLength} characters long.`,
    };
  }

  if (normalized.length > ORGANIZATION_POLICY.slug.maxLength) {
    return {
      valid: false,
      normalized,
      error: `Slug must not exceed ${ORGANIZATION_POLICY.slug.maxLength} characters.`,
    };
  }

  if (!ORGANIZATION_POLICY.slug.pattern.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'Slug may only contain lowercase alphanumeric characters separated by single hyphens.',
    };
  }

  if (RESERVED_ORGANIZATION_SLUGS.has(normalized)) {
    return {
      valid: false,
      normalized,
      error: `'${normalized}' is a reserved platform name and cannot be used as an organization slug.`,
    };
  }

  return { valid: true, normalized };
}

export class OrganizationPolicyError extends ApplicationError {
  constructor(code: string, message: string) {
    super({
      code,
      message,
      statusCode: 400,
      safeMessage: message,
    });
  }
}

export function assertValidSlug(raw: string): string {
  const normalized = normalizeSlug(raw);

  if (normalized.length < ORGANIZATION_POLICY.slug.minLength) {
    throw new OrganizationPolicyError(
      'SLUG_TOO_SHORT',
      `Slug must be at least ${ORGANIZATION_POLICY.slug.minLength} characters long.`
    );
  }

  if (normalized.length > ORGANIZATION_POLICY.slug.maxLength) {
    throw new OrganizationPolicyError(
      'SLUG_TOO_LONG',
      `Slug must not exceed ${ORGANIZATION_POLICY.slug.maxLength} characters.`
    );
  }

  if (!ORGANIZATION_POLICY.slug.pattern.test(normalized)) {
    throw new OrganizationPolicyError(
      'SLUG_INVALID_PATTERN',
      'Slug may only contain lowercase alphanumeric characters separated by single hyphens.'
    );
  }

  if (RESERVED_ORGANIZATION_SLUGS.has(normalized)) {
    throw new OrganizationPolicyError(
      'RESERVED_SLUG',
      `'${normalized}' is a reserved platform name and cannot be used as an organization slug.`
    );
  }

  return normalized;
}
