import { NextRequest } from 'next/server';
import { AuthUserSession, getSessionFromRequest, UserRole } from './session';
import { ApplicationError } from '@/lib/errors/application-error';

export const DEFAULT_DEMO_MERCHANT_ID = 'mer_saasify_blr';
export const DEFAULT_DEMO_MERCHANT_NAME = 'SaaSify Technologies India Pvt Ltd';

export const DEMO_FALLBACK_SESSION: AuthUserSession = {
  userId: 'usr_demo_admin',
  email: 'merchant@saasify.in',
  name: 'Ujjwal (Admin)',
  role: 'ADMIN',
  merchantId: DEFAULT_DEMO_MERCHANT_ID,
  merchantName: DEFAULT_DEMO_MERCHANT_NAME,
  organizationId: DEFAULT_DEMO_MERCHANT_ID,
  organizationName: DEFAULT_DEMO_MERCHANT_NAME,
  organizationSlug: 'saasify',
};

/**
 * Ensures request has an active tenant session.
 * In production, fails closed with 401 if unauthenticated.
 * In development/test mode, falls back to demo merchant session only if strictAuth is false.
 */
export async function getTenantContext(req: NextRequest, strictAuth = false): Promise<AuthUserSession> {
  const session = await getSessionFromRequest(req);
  if (session) {
    if (session.pendingMfa) {
      throw new ApplicationError({
        code: 'MFA_REQUIRED',
        message: 'Two-factor authentication challenge required.',
        statusCode: 403,
        safeMessage: 'Please complete two-factor authentication to access this workspace.',
      });
    }
    if (!session.organizationId) {
      session.organizationId = session.merchantId;
      session.organizationName = session.merchantName;
      session.organizationSlug = 'saasify';
    }
    return session;
  }

  // Strict fail-closed in production
  if (process.env.APP_ENV === 'production' || strictAuth) {
    throw new ApplicationError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required: No active session found.',
      statusCode: 401,
      safeMessage: 'Please log in to continue.',
    });
  }

  // Graceful development fallback
  return DEMO_FALLBACK_SESSION;
}

/**
 * Validates that the user has authorization for the specified merchant.
 * Throws an error if a tenant attempts cross-tenant access.
 */
export function assertTenantAccess(session: AuthUserSession, targetMerchantId: string): void {
  if (session.merchantId !== targetMerchantId) {
    throw new ApplicationError({
      code: 'CROSS_TENANT_ACCESS_DENIED',
      message: `Unauthorized cross-tenant access attempt: ${session.merchantId} -> ${targetMerchantId}`,
      statusCode: 403,
      safeMessage: 'Access denied.',
    });
  }
}

/**
 * Role-Based Access Control (RBAC) foundation checks
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  OPERATOR: 2,
  ANALYST: 1,
};

export function hasMinimumRole(userRole: UserRole, minimumRequiredRole: UserRole): boolean {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[minimumRequiredRole] || 0);
}

export function canApproveRecovery(role: UserRole): boolean {
  // OWNER, ADMIN, and OPERATOR can approve recoveries
  return ['OWNER', 'ADMIN', 'OPERATOR'].includes(role);
}

export function canModifyPolicies(role: UserRole): boolean {
  // Only OWNER and ADMIN can alter guardrail policies
  return ['OWNER', 'ADMIN'].includes(role);
}

export function canManageApiKeys(role: UserRole): boolean {
  // Only OWNER and ADMIN can manage developer keys
  return ['OWNER', 'ADMIN'].includes(role);
}

export function canManageBilling(role: UserRole): boolean {
  // Only OWNER and ADMIN can manage commercial billing
  return ['OWNER', 'ADMIN'].includes(role);
}
