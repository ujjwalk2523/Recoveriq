/**
 * Phase 8.7.3 — Enterprise Compliance Evidence Types & Control Definitions
 *
 * RecoverIQ Compliance Evidence provides reproducible, integrity-verifiable
 * evidence packages derived from authoritative tenant records.
 *
 * NOTICE: RecoverIQ generates evidence supporting organizational compliance
 * activities, but evidence generation does not itself establish regulatory
 * or certification compliance. Never claim external certification without
 * an independent audit.
 */

export type EvidencePackageType =
  | 'SECURITY_ACTIVITY'
  | 'ACCESS_CONTROL'
  | 'AUTHENTICATION'
  | 'MFA'
  | 'SESSION_MANAGEMENT'
  | 'ORGANIZATION_GOVERNANCE'
  | 'API_SECURITY'
  | 'BILLING_GOVERNANCE'
  | 'PAYMENT_GOVERNANCE'
  | 'RECOVERY_GOVERNANCE'
  | 'CHANGE_MANAGEMENT';

export type EvidenceStatus =
  | 'DRAFT'
  | 'GENERATING'
  | 'READY'
  | 'INTEGRITY_FAILED'
  | 'FAILED';

export type AuditChainStatus =
  | 'VERIFIED'
  | 'TAMPER_DETECTED'
  | 'NOT_APPLICABLE';

export type EvidenceSourceType =
  | 'AuditLog'
  | 'Organization'
  | 'OrganizationMember'
  | 'Team'
  | 'ApiKey'
  | 'WebhookEndpoint'
  | 'Subscription'
  | 'Invoice'
  | 'UsageLedgerEntry'
  | 'Transaction'
  | 'RecoveryAttempt'
  | 'DecisionTrace'
  | 'PolicyGuardrails'
  | 'SecurityConfiguration';

export interface ComplianceControlDefinition {
  controlId: string;
  name: string;
  description: string;
  category: EvidencePackageType;
  version: string;
  evidenceSources: EvidenceSourceType[];
  requiredEvents?: string[];
  verificationMethod: string;
}

export interface ComplianceEvidenceItem {
  id: string;
  packageId: string;
  evidenceType: string;
  sourceType: EvidenceSourceType;
  sourceId: string;
  description: string;
  occurredAt: string; // ISO 8601 UTC
  metadata: Record<string, any>;
  evidenceHash: string; // SHA-256
  sequence: number;
}

export interface ComplianceEvidencePackage {
  id: string;
  organizationId: string;
  packageType: EvidencePackageType;
  controlId: string;
  title: string;
  description: string;
  periodStart: string; // ISO 8601 UTC
  periodEnd: string; // ISO 8601 UTC
  status: EvidenceStatus;
  auditChainStatus: AuditChainStatus;
  checkedAuditEvents: number;
  totalItems: number;
  sourceCounts: Record<string, number>;
  packageHash: string; // SHA-256 manifest hash
  manifest: {
    itemHashes: string[];
    sourceTypes: string[];
    schemaVersion: number;
    generatorVersion: string;
    controlVersion: string;
  };
  generatedBy: string; // Actor ID / name
  generatorVersion: string;
  schemaVersion: number;
  generatedAt: string;
  items?: ComplianceEvidenceItem[];
}

export interface GenerateEvidenceParams {
  organizationId: string;
  controlId: string;
  periodStart: string;
  periodEnd: string;
  generatedBy: string;
  title?: string;
  description?: string;
}

export interface EvidenceVerificationResult {
  valid: boolean;
  packageId: string;
  checkedItems: number;
  packageHashValid: boolean;
  itemHashesValid: boolean;
  auditChainValid: boolean;
  integrityStatus: EvidenceStatus;
  firstInvalidItem?: {
    itemId: string;
    sequence: number;
    expectedHash: string;
    computedHash: string;
    reason: string;
  } | null;
  message: string;
}

export interface EvidenceExportPayload {
  exportVersion: string;
  exportedAt: string;
  disclaimer: string;
  package: ComplianceEvidencePackage;
  items: ComplianceEvidenceItem[];
  verification: {
    verified: boolean;
    auditIntegrity: AuditChainStatus;
    verifiedAt: string;
  };
}

/**
 * Authoritative Internal Compliance Control Definitions
 */
export const COMPLIANCE_CONTROLS: Record<string, ComplianceControlDefinition> = {
  'AUTH-001': {
    controlId: 'AUTH-001',
    name: 'Authentication & Session Lifecycle Auditability',
    description: 'Verifies that user authentication attempts, session creations, token rotations, and revocations produce immutable, traceable audit evidence.',
    category: 'AUTHENTICATION',
    version: '1.0.0',
    evidenceSources: ['AuditLog'],
    requiredEvents: ['AUTH_LOGIN_SUCCESS', 'AUTH_LOGIN_FAILED', 'AUTH_LOGOUT', 'AUTH_SESSION_REVOKED'],
    verificationMethod: 'CRYPTOGRAPHIC_HASH_CHAIN_AND_SESSION_RECONCILIATION',
  },
  'MFA-001': {
    controlId: 'MFA-001',
    name: 'Multi-Factor Authentication Enrollment & Enforcement',
    description: 'Verifies that MFA enrollment, challenge verifications, disablement, and recovery code regenerations are logged with zero plain secret exposure.',
    category: 'MFA',
    version: '1.0.0',
    evidenceSources: ['AuditLog'],
    requiredEvents: ['AUTH_MFA_ENROLLED', 'AUTH_MFA_VERIFIED', 'AUTH_MFA_DISABLED', 'AUTH_MFA_RECOVERY_CODES_REGENERATED'],
    verificationMethod: 'SECRET_REDACTION_AND_AUDIT_LOG_VERIFICATION',
  },
  'ORG-001': {
    controlId: 'ORG-001',
    name: 'Organization Membership & Role Governance',
    description: 'Verifies that organization invitations, member additions, role changes, ownership transfers, and team assignments maintain dual state audit history.',
    category: 'ORGANIZATION_GOVERNANCE',
    version: '1.0.0',
    evidenceSources: ['AuditLog', 'Organization', 'OrganizationMember', 'Team'],
    requiredEvents: ['ORG_MEMBER_INVITED', 'ORG_MEMBER_JOINED', 'ORG_MEMBER_ROLE_UPDATED', 'ORG_OWNER_TRANSFERRED'],
    verificationMethod: 'STATE_TRANSITION_DIFF_AND_ORGANIZATION_SCOPE_AUDIT',
  },
  'API-001': {
    controlId: 'API-001',
    name: 'API Key Security & Cryptographic Storage',
    description: 'Verifies that programmatic API keys are created with explicit scopes, verified via constant-time SHA-256 hashes, rotated safely, and never stored in plaintext.',
    category: 'API_SECURITY',
    version: '1.0.0',
    evidenceSources: ['AuditLog', 'ApiKey'],
    requiredEvents: ['API_KEY_CREATED', 'API_KEY_ROTATED', 'API_KEY_REVOKED'],
    verificationMethod: 'HASHED_SECRET_INSPECTION_AND_SCOPE_VALIDATION',
  },
  'SEC-001': {
    controlId: 'SEC-001',
    name: 'Security Configuration & Diagnostic Authorization',
    description: 'Verifies that security policy updates, domain verifications, IdP configurations, and system diagnostics are restricted to privileged roles and logged.',
    category: 'SECURITY_ACTIVITY',
    version: '1.0.0',
    evidenceSources: ['AuditLog', 'SecurityConfiguration'],
    requiredEvents: ['ORG_SECURITY_UPDATED', 'SSO_CONFIG_UPDATED', 'DOMAIN_VERIFIED'],
    verificationMethod: 'RBAC_ENFORCEMENT_AUDIT_AND_POLICY_SNAPSHOT',
  },
  'BIL-001': {
    controlId: 'BIL-001',
    name: 'Billing Integrity & Immutable Usage Ledger Reconciliation',
    description: 'Verifies that commercial plan subscriptions, metered usage events, and billing invoices maintain authoritative integer accounting without ad-hoc mutation.',
    category: 'BILLING_GOVERNANCE',
    version: '1.0.0',
    evidenceSources: ['AuditLog', 'Subscription', 'Invoice', 'UsageLedgerEntry'],
    requiredEvents: ['BILLING_PLAN_CHANGED', 'USAGE_RECORDED', 'INVOICE_GENERATED'],
    verificationMethod: 'USAGE_LEDGER_IMMUTABILITY_AND_INVOICE_RECONCILIATION',
  },
  'REC-001': {
    controlId: 'REC-001',
    name: 'Recovery Strategy Decisions & Human Approval Governance',
    description: 'Verifies that automated payment recovery actions respect policy guardrails and high-value transactions require human sign-off with recorded rationale.',
    category: 'RECOVERY_GOVERNANCE',
    version: '1.0.0',
    evidenceSources: ['AuditLog', 'Transaction', 'RecoveryAttempt', 'DecisionTrace', 'PolicyGuardrails'],
    requiredEvents: ['TRANSACTION_RECOVERY_EVALUATED', 'TRANSACTION_APPROVED', 'TRANSACTION_REJECTED'],
    verificationMethod: 'DECISION_TRACE_AUDIT_AND_GUARDRAIL_COMPLIANCE',
  },
  'CHANGE-001': {
    controlId: 'CHANGE-001',
    name: 'System Change Management & Webhook Lifecycle',
    description: 'Verifies that administrative webhook endpoints, dispatch secrets, and environment configurations are securely registered and tracked through immutable audit logs.',
    category: 'CHANGE_MANAGEMENT',
    version: '1.0.0',
    evidenceSources: ['AuditLog', 'WebhookEndpoint'],
    requiredEvents: ['WEBHOOK_ENDPOINT_CREATED', 'WEBHOOK_SECRET_ROTATED', 'WEBHOOK_ENDPOINT_DISABLED'],
    verificationMethod: 'ENDPOINT_HEALTH_AND_AUDIT_TRAIL_VERIFICATION',
  },
};
