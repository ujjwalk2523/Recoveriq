import { UserRole } from '@/lib/auth/session';
import { ApplicationError } from '@/lib/errors/application-error';

export type OrganizationPermission =
  | 'ORG_VIEW'
  | 'ORG_MANAGE_SETTINGS'
  | 'ORG_DELETE'
  | 'ORG_TRANSFER_OWNERSHIP'
  | 'MEMBER_VIEW'
  | 'MEMBER_INVITE'
  | 'MEMBER_UPDATE_ROLE'
  | 'MEMBER_SUSPEND'
  | 'MEMBER_REMOVE'
  | 'TEAM_VIEW'
  | 'TEAM_CREATE'
  | 'TEAM_UPDATE'
  | 'TEAM_DELETE'
  | 'TEAM_MANAGE_MEMBERS'
  | 'POLICY_READ'
  | 'POLICY_WRITE'
  | 'PAYMENT_VIEW'
  | 'PAYMENT_RECOVER'
  | 'API_KEYS_VIEW'
  | 'API_KEYS_MANAGE'
  | 'AUDIT_LOG_VIEW'
  | 'BILLING_MANAGE'
  | 'ORGANIZATION_VIEW'
  | 'ORGANIZATION_UPDATE'
  | 'MEMBERS_VIEW'
  | 'MEMBERS_INVITE'
  | 'MEMBERS_UPDATE'
  | 'MEMBERS_REMOVE'
  | 'TEAMS_VIEW'
  | 'TEAMS_CREATE'
  | 'TEAMS_UPDATE'
  | 'TEAMS_DELETE'
  | 'TEAMS_ASSIGN_MEMBERS'
  | 'BILLING_VIEW'
  | 'API_KEYS_CREATE'
  | 'API_KEYS_REVOKE'
  | 'PAYMENT_PROVIDER_VIEW'
  | 'PAYMENT_PROVIDER_MANAGE'
  | 'POLICY_VIEW'
  | 'POLICY_MANAGE'
  | 'RECOVERY_VIEW'
  | 'RECOVERY_OPERATE'
  | 'RECOVERY_APPROVE'
  | 'ANALYTICS_VIEW'
  | 'AUDIT_VIEW'
  | 'SECURITY_VIEW';

export const ROLE_PERMISSION_MATRIX: Record<UserRole, Set<OrganizationPermission>> = {
  OWNER: new Set<OrganizationPermission>([
    'ORG_VIEW',
    'ORG_MANAGE_SETTINGS',
    'ORG_DELETE',
    'ORG_TRANSFER_OWNERSHIP',
    'MEMBER_VIEW',
    'MEMBER_INVITE',
    'MEMBER_UPDATE_ROLE',
    'MEMBER_SUSPEND',
    'MEMBER_REMOVE',
    'TEAM_VIEW',
    'TEAM_CREATE',
    'TEAM_UPDATE',
    'TEAM_DELETE',
    'TEAM_MANAGE_MEMBERS',
    'POLICY_READ',
    'POLICY_WRITE',
    'PAYMENT_VIEW',
    'PAYMENT_RECOVER',
    'API_KEYS_VIEW',
    'API_KEYS_MANAGE',
    'AUDIT_LOG_VIEW',
    'BILLING_MANAGE',
    'ORGANIZATION_VIEW',
    'ORGANIZATION_UPDATE',
    'MEMBERS_VIEW',
    'MEMBERS_INVITE',
    'MEMBERS_UPDATE',
    'MEMBERS_REMOVE',
    'TEAMS_VIEW',
    'TEAMS_CREATE',
    'TEAMS_UPDATE',
    'TEAMS_DELETE',
    'TEAMS_ASSIGN_MEMBERS',
    'BILLING_VIEW',
    'API_KEYS_CREATE',
    'API_KEYS_REVOKE',
    'PAYMENT_PROVIDER_VIEW',
    'PAYMENT_PROVIDER_MANAGE',
    'POLICY_VIEW',
    'POLICY_MANAGE',
    'RECOVERY_VIEW',
    'RECOVERY_OPERATE',
    'RECOVERY_APPROVE',
    'ANALYTICS_VIEW',
    'AUDIT_VIEW',
    'SECURITY_VIEW',
  ]),
  ADMIN: new Set<OrganizationPermission>([
    'ORG_VIEW',
    'ORG_MANAGE_SETTINGS',
    'MEMBER_VIEW',
    'MEMBER_INVITE',
    'MEMBER_UPDATE_ROLE',
    'MEMBER_SUSPEND',
    'MEMBER_REMOVE',
    'TEAM_VIEW',
    'TEAM_CREATE',
    'TEAM_UPDATE',
    'TEAM_DELETE',
    'TEAM_MANAGE_MEMBERS',
    'POLICY_READ',
    'POLICY_WRITE',
    'PAYMENT_VIEW',
    'PAYMENT_RECOVER',
    'API_KEYS_VIEW',
    'API_KEYS_MANAGE',
    'AUDIT_LOG_VIEW',
    'ORGANIZATION_VIEW',
    'ORGANIZATION_UPDATE',
    'MEMBERS_VIEW',
    'MEMBERS_INVITE',
    'MEMBERS_UPDATE',
    'MEMBERS_REMOVE',
    'TEAMS_VIEW',
    'TEAMS_CREATE',
    'TEAMS_UPDATE',
    'TEAMS_DELETE',
    'TEAMS_ASSIGN_MEMBERS',
    'BILLING_VIEW',
    'API_KEYS_CREATE',
    'API_KEYS_REVOKE',
    'PAYMENT_PROVIDER_VIEW',
    'PAYMENT_PROVIDER_MANAGE',
    'POLICY_VIEW',
    'POLICY_MANAGE',
    'RECOVERY_VIEW',
    'RECOVERY_OPERATE',
    'RECOVERY_APPROVE',
    'ANALYTICS_VIEW',
    'AUDIT_VIEW',
    'SECURITY_VIEW',
  ]),
  OPERATOR: new Set<OrganizationPermission>([
    'ORG_VIEW',
    'MEMBER_VIEW',
    'TEAM_VIEW',
    'POLICY_READ',
    'POLICY_WRITE',
    'PAYMENT_VIEW',
    'PAYMENT_RECOVER',
    'ORGANIZATION_VIEW',
    'MEMBERS_VIEW',
    'TEAMS_VIEW',
    'POLICY_VIEW',
    'RECOVERY_VIEW',
    'RECOVERY_OPERATE',
    'RECOVERY_APPROVE',
    'ANALYTICS_VIEW',
  ]),
  ANALYST: new Set<OrganizationPermission>([
    'ORG_VIEW',
    'MEMBER_VIEW',
    'TEAM_VIEW',
    'POLICY_READ',
    'PAYMENT_VIEW',
    'AUDIT_LOG_VIEW',
    'ORGANIZATION_VIEW',
    'MEMBERS_VIEW',
    'TEAMS_VIEW',
    'POLICY_VIEW',
    'RECOVERY_VIEW',
    'ANALYTICS_VIEW',
    'AUDIT_VIEW',
  ]),
};

export const ROLE_PERMISSIONS: Record<UserRole, OrganizationPermission[]> = {
  OWNER: Array.from(ROLE_PERMISSION_MATRIX.OWNER),
  ADMIN: Array.from(ROLE_PERMISSION_MATRIX.ADMIN),
  OPERATOR: Array.from(ROLE_PERMISSION_MATRIX.OPERATOR),
  ANALYST: Array.from(ROLE_PERMISSION_MATRIX.ANALYST),
};

/**
 * Checks whether a given role has the specified organization permission.
 */
export function hasPermission(role: UserRole, permission: OrganizationPermission): boolean {
  const permissions = ROLE_PERMISSION_MATRIX[role];
  return permissions ? permissions.has(permission) : false;
}

/**
 * Asserts that a given role has the required permission; throws 403 Forbidden if not.
 */
export function assertPermission(role: UserRole, permission: OrganizationPermission): void {
  if (!hasPermission(role, permission)) {
    throw new ApplicationError({
      code: 'INSUFFICIENT_PERMISSIONS',
      message: `Role '${role}' lacks required permission '${permission}'.`,
      statusCode: 403,
      safeMessage: 'You do not have permission to perform this action in this organization.',
    });
  }
}
