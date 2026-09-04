import { SecurityContext } from './security-context';
import { UserRole } from '@/lib/auth/session';
import { ApplicationError } from '@/lib/errors/application-error';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  OPERATOR: 2,
  ANALYST: 1,
};

export class UnauthorizedError extends ApplicationError {
  constructor(message = 'Authentication required to perform this action.') {
    super({
      code: 'UNAUTHORIZED',
      message,
      statusCode: 401,
      safeMessage: 'Please log in to continue.',
    });
  }
}

export class ForbiddenError extends ApplicationError {
  constructor(message = 'You do not have permission to perform this action.') {
    super({
      code: 'FORBIDDEN',
      message,
      statusCode: 403,
      safeMessage: 'Access denied. Please contact your organization administrator.',
    });
  }
}

export class TenantBoundaryViolationError extends ApplicationError {
  constructor(targetMerchantId: string) {
    super({
      code: 'CROSS_TENANT_ACCESS_DENIED',
      message: `Access denied: Principal cannot access resources belonging to merchant '${targetMerchantId}'.`,
      statusCode: 403,
      safeMessage: 'Access denied.',
    });
  }
}

/**
 * Asserts that the context has an authenticated user or API key.
 */
export function requireAuthenticated(context: SecurityContext): void {
  if (context.principalType === 'SYSTEM' && context.principal === 'anonymous') {
    throw new UnauthorizedError();
  }
  if (!context.merchantId) {
    throw new UnauthorizedError('No tenant association found in security context.');
  }
}

/**
 * Asserts that the principal has at least the specified RBAC role level.
 */
export function requireRole(context: SecurityContext, minimumRole: UserRole): void {
  requireAuthenticated(context);

  if (context.principalType === 'API_KEY' || context.principalType === 'INTERNAL_WORKER') {
    // API keys and workers use scopes, but have base operational access
    return;
  }

  const userRole = context.roles[0];
  if (!userRole) {
    throw new ForbiddenError('No role assigned to user.');
  }

  const currentLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[minimumRole] || 0;

  if (currentLevel < requiredLevel) {
    throw new ForbiddenError(
      `Insufficient privileges. Requires role '${minimumRole}' or higher, but user has '${userRole}'.`
    );
  }
}

/**
 * Asserts that the authenticated principal is an OWNER.
 */
export function requireOwner(context: SecurityContext): void {
  requireRole(context, 'OWNER');
}

/**
 * Asserts that the authenticated principal is an ADMIN or OWNER.
 */
export function requireAdmin(context: SecurityContext): void {
  requireRole(context, 'ADMIN');
}

/**
 * Asserts that the authenticated principal is an OPERATOR, ADMIN, or OWNER.
 */
export function requireOperator(context: SecurityContext): void {
  requireRole(context, 'OPERATOR');
}

/**
 * Enforces strict multi-tenant boundary.
 * The principal's merchantId must strictly match the target merchantId.
 */
export function requireMerchantAccess(context: SecurityContext, targetMerchantId: string): void {
  requireAuthenticated(context);

  if (context.merchantId !== targetMerchantId) {
    throw new TenantBoundaryViolationError(targetMerchantId);
  }
}

/**
 * Enforces resource ownership.
 * Fails closed if the resource belongs to another tenant or if tenant ownership is indeterminate.
 */
export function requireResourceOwnership(
  context: SecurityContext,
  resourceMerchantId?: string | null
): void {
  requireAuthenticated(context);

  if (!resourceMerchantId || context.merchantId !== resourceMerchantId) {
    throw new TenantBoundaryViolationError(resourceMerchantId || 'unknown');
  }
}

/**
 * Asserts that an API Key or principal possesses the required scope.
 */
export function requireScope(context: SecurityContext, requiredScope: string): void {
  requireAuthenticated(context);

  // Browser UI users with roles bypass granular API scopes
  if (context.principalType === 'USER_SESSION') {
    return;
  }

  const hasScope =
    context.scopes.includes('*') ||
    context.scopes.includes(requiredScope) ||
    context.scopes.some((s) => s.endsWith(':*') && requiredScope.startsWith(s.slice(0, -1)));

  if (!hasScope) {
    throw new ForbiddenError(`API key is missing required scope: '${requiredScope}'.`);
  }
}

/**
 * Enforces strict organization boundary.
 * The principal's organizationId must strictly match the target organizationId.
 */
export function requireOrganizationAccess(context: SecurityContext, targetOrgId: string): void {
  requireAuthenticated(context);

  const effectiveOrgId = context.organizationId || context.merchantId;
  if (!effectiveOrgId || effectiveOrgId !== targetOrgId) {
    throw new TenantBoundaryViolationError(targetOrgId);
  }
}

/**
 * Asserts that the principal has the specified granular organization permission.
 */
export function requirePermission(context: SecurityContext, permission: any): void {
  requireAuthenticated(context);

  if (context.principalType === 'API_KEY' || context.principalType === 'INTERNAL_WORKER') {
    return;
  }

  const userRole = context.roles[0];
  if (!userRole) {
    throw new ForbiddenError('No role assigned to user in this organization.');
  }

  const { assertPermission } = require('@/lib/organization/permission-matrix');
  assertPermission(userRole, permission);
}
