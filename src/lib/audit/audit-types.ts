/**
 * RecoverIQ — Enterprise Audit Ledger Types & Enums (Phase 8.7.1)
 */

export const ACTOR_TYPES = [
  'USER',
  'API_KEY',
  'SYSTEM',
  'WORKER',
  'WEBHOOK',
  'SERVICE',
  'ANONYMOUS',
] as const;

export type ActorType = (typeof ACTOR_TYPES)[number];

export const AUDIT_CATEGORIES = [
  'AUTHENTICATION',
  'AUTHORIZATION',
  'IDENTITY',
  'MFA',
  'SESSION',
  'ORGANIZATION',
  'MEMBERSHIP',
  'TEAM',
  'API',
  'BILLING',
  'PAYMENT',
  'RECOVERY',
  'WEBHOOK',
  'SECURITY',
  'SYSTEM',
  'CONFIGURATION',
] as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export const AUDIT_SEVERITIES = [
  'INFO',
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
] as const;

export type AuditSeverity = (typeof AUDIT_SEVERITIES)[number];

export const AUDIT_RESULTS = [
  'SUCCESS',
  'FAILURE',
  'DENIED',
  'PARTIAL',
] as const;

export type AuditResult = (typeof AUDIT_RESULTS)[number];

export const AUDIT_RESOURCE_TYPES = [
  'USER',
  'SESSION',
  'ORGANIZATION',
  'MEMBERSHIP',
  'TEAM',
  'API_KEY',
  'WEBHOOK_ENDPOINT',
  'SUBSCRIPTION',
  'INVOICE',
  'PAYMENT',
  'TRANSACTION',
  'RECOVERY_SEQUENCE',
  'RECOVERY_ATTEMPT',
  'POLICY',
  'IDENTITY_PROVIDER',
  'DOMAIN',
] as const;

export type AuditResourceType = (typeof AUDIT_RESOURCE_TYPES)[number];

export const AUDIT_ACTIONS = {
  // Authentication & Identity
  AUTH_LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
  AUTH_LOGIN_FAILURE: 'AUTH_LOGIN_FAILURE',
  AUTH_LOGOUT: 'AUTH_LOGOUT',
  AUTH_LOGOUT_ALL: 'AUTH_LOGOUT_ALL',
  AUTH_PASSWORD_CHANGED: 'AUTH_PASSWORD_CHANGED',
  AUTH_PASSWORD_RESET_REQUESTED: 'AUTH_PASSWORD_RESET_REQUESTED',
  AUTH_PASSWORD_RESET_COMPLETED: 'AUTH_PASSWORD_RESET_COMPLETED',
  AUTH_EMAIL_VERIFIED: 'AUTH_EMAIL_VERIFIED',
  AUTH_EMAIL_CHANGED: 'AUTH_EMAIL_CHANGED',
  AUTH_MFA_ENABLED: 'AUTH_MFA_ENABLED',
  AUTH_MFA_DISABLED: 'AUTH_MFA_DISABLED',
  AUTH_MFA_CHALLENGE_SUCCESS: 'AUTH_MFA_CHALLENGE_SUCCESS',
  AUTH_MFA_CHALLENGE_FAILURE: 'AUTH_MFA_CHALLENGE_FAILURE',
  AUTH_MFA_RECOVERY_USED: 'AUTH_MFA_RECOVERY_USED',
  AUTH_SESSION_CREATED: 'AUTH_SESSION_CREATED',
  AUTH_SESSION_REVOKED: 'AUTH_SESSION_REVOKED',
  AUTH_SESSION_REVOKED_ALL: 'AUTH_SESSION_REVOKED_ALL',
  AUTH_IDENTITY_LINKED: 'AUTH_IDENTITY_LINKED',
  AUTH_IDENTITY_UNLINKED: 'AUTH_IDENTITY_UNLINKED',
  AUTH_SSO_LOGIN: 'AUTH_SSO_LOGIN',
  AUTH_SSO_CONFIGURATION_CHANGED: 'AUTH_SSO_CONFIGURATION_CHANGED',

  // Organization & Membership & Team
  ORG_CREATED: 'ORG_CREATED',
  ORG_UPDATED: 'ORG_UPDATED',
  ORG_DELETED: 'ORG_DELETED',
  ORG_MEMBER_INVITED: 'ORG_MEMBER_INVITED',
  ORG_MEMBER_JOINED: 'ORG_MEMBER_JOINED',
  ORG_MEMBER_REMOVED: 'ORG_MEMBER_REMOVED',
  ORG_MEMBER_ROLE_CHANGED: 'ORG_MEMBER_ROLE_CHANGED',
  ORG_TEAM_CREATED: 'ORG_TEAM_CREATED',
  ORG_TEAM_UPDATED: 'ORG_TEAM_UPDATED',
  ORG_TEAM_DELETED: 'ORG_TEAM_DELETED',
  ORG_TEAM_MEMBER_ADDED: 'ORG_TEAM_MEMBER_ADDED',
  ORG_TEAM_MEMBER_REMOVED: 'ORG_TEAM_MEMBER_REMOVED',
  ORG_OWNER_TRANSFERRED: 'ORG_OWNER_TRANSFERRED',

  // API & Webhooks
  API_KEY_CREATED: 'API_KEY_CREATED',
  API_KEY_REVOKED: 'API_KEY_REVOKED',
  API_KEY_ROTATED: 'API_KEY_ROTATED',
  WEBHOOK_ENDPOINT_CREATED: 'WEBHOOK_ENDPOINT_CREATED',
  WEBHOOK_ENDPOINT_UPDATED: 'WEBHOOK_ENDPOINT_UPDATED',
  WEBHOOK_ENDPOINT_DELETED: 'WEBHOOK_ENDPOINT_DELETED',

  // Billing
  BILLING_PLAN_CHANGED: 'BILLING_PLAN_CHANGED',
  BILLING_SUBSCRIPTION_CHANGED: 'BILLING_SUBSCRIPTION_CHANGED',
  BILLING_PAYMENT_FAILED: 'BILLING_PAYMENT_FAILED',

  // Payment Provider
  PAYMENT_PROVIDER_CONNECTED: 'PAYMENT_PROVIDER_CONNECTED',
  PAYMENT_PROVIDER_UPDATED: 'PAYMENT_PROVIDER_UPDATED',
  PAYMENT_PROVIDER_REVOKED: 'PAYMENT_PROVIDER_REVOKED',

  // Recovery Engine
  RECOVERY_DECISION_CREATED: 'RECOVERY_DECISION_CREATED',
  RECOVERY_SEQUENCE_STARTED: 'RECOVERY_SEQUENCE_STARTED',
  RECOVERY_SEQUENCE_COMPLETED: 'RECOVERY_SEQUENCE_COMPLETED',
  RECOVERY_ACTION_EXECUTED: 'RECOVERY_ACTION_EXECUTED',
  RECOVERY_ACTION_FAILED: 'RECOVERY_ACTION_FAILED',

  // Security & System
  SECURITY_POLICY_CHANGED: 'SECURITY_POLICY_CHANGED',
  SECURITY_SUSPICIOUS_ACTIVITY: 'SECURITY_SUSPICIOUS_ACTIVITY',
  SYSTEM_MAINTENANCE: 'SYSTEM_MAINTENANCE',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS] | string;

export interface AuditActor {
  type: ActorType;
  id?: string;
  displayName?: string;
  email?: string;
}

export interface AuditResource {
  type: AuditResourceType | string;
  id: string;
}

export interface AuditEventInput {
  organizationId?: string;
  merchantId?: string;
  actor: AuditActor;
  action: AuditAction;
  category: AuditCategory;
  severity?: AuditSeverity;
  result?: AuditResult;
  resource: AuditResource;
  requestId?: string;
  sessionId?: string;
  ipHash?: string;
  userAgentSummary?: string;
  metadata?: Record<string, any>;
  previousState?: Record<string, any>;
  newState?: Record<string, any>;
  occurredAt?: Date;
}

export interface AuditEventRecord {
  id: string;
  organizationId: string | null;
  merchantId: string | null;
  actor: {
    type: ActorType;
    id: string | null;
    displayName: string | null;
    email: string | null;
  };
  action: string;
  category: AuditCategory;
  severity: AuditSeverity;
  result: AuditResult;
  resource: {
    type: string;
    id: string;
  };
  requestId: string | null;
  sessionId: string | null;
  ipHash: string | null;
  userAgentSummary: string | null;
  metadata: Record<string, any> | null;
  previousState: Record<string, any> | null;
  newState: Record<string, any> | null;
  integrity: {
    sequenceNumber: number;
    eventHash: string;
    previousEventHash: string | null;
    schemaVersion: number;
  };
  occurredAt: string;
  createdAt: string;
}

export interface AuditQueryFilters {
  organizationId: string;
  merchantId?: string;
  action?: string;
  category?: AuditCategory;
  severity?: AuditSeverity;
  result?: AuditResult;
  actorType?: ActorType;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  cursor?: string;
  limit?: number;
  direction?: 'ASC' | 'DESC';
}

export interface AuditChainVerificationResult {
  valid: boolean;
  checkedEvents: number;
  firstInvalidSequence?: number;
  reason?: string;
}
