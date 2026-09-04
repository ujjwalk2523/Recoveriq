import { AuditService } from '@/lib/services/audit.service';
import { redactSensitiveObject } from '@/lib/observability/logger';
import { ActorType, AuditCategory, AuditSeverity, AuditResult } from '@/lib/audit/audit-types';

export type SecurityActionType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGOUT'
  | 'SESSION_REVOKED'
  | 'API_KEY_CREATED'
  | 'API_KEY_REVOKED'
  | 'API_KEY_EXPIRED'
  | 'ROLE_CHANGED'
  | 'PROVIDER_ACCOUNT_CREATED'
  | 'PROVIDER_ACCOUNT_ROTATED'
  | 'PROVIDER_ACCOUNT_REVOKED'
  | 'RECOVERY_APPROVED'
  | 'RECOVERY_REJECTED'
  | 'POLICY_CHANGED'
  | 'BILLING_STATUS_CHANGED'
  | 'LIVE_EXECUTION_ENABLED'
  | 'LIVE_EXECUTION_DISABLED'
  | 'SECURITY_SETTING_CHANGED'
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILURE'
  | 'AUTH_LOGOUT'
  | 'AUTH_LOGOUT_ALL'
  | 'AUTH_PASSWORD_CHANGED'
  | 'AUTH_PASSWORD_RESET_REQUESTED'
  | 'AUTH_PASSWORD_RESET_COMPLETED'
  | 'AUTH_EMAIL_VERIFIED'
  | 'AUTH_EMAIL_CHANGE_REQUESTED'
  | 'AUTH_EMAIL_CHANGE_COMPLETED'
  | 'AUTH_MFA_ENROLLED'
  | 'AUTH_MFA_VERIFIED'
  | 'AUTH_MFA_DISABLED'
  | 'AUTH_MFA_RECOVERY_USED'
  | 'AUTH_SESSION_CREATED'
  | 'AUTH_SESSION_REVOKED'
  | 'AUTH_SESSION_REVOKED_ALL'
  | 'AUTH_IDENTITY_LINKED'
  | 'AUTH_IDENTITY_UNLINKED'
  | 'AUTH_SSO_LOGIN'
  | 'AUTH_SSO_CONFIGURATION_CHANGED'
  | 'AUTH_DOMAIN_VERIFIED'
  | 'AUTH_STEP_UP_VERIFIED'
  | 'SECURITY_NOTIFICATION_SENT'
  | 'ORGANIZATION_MEMBER_ADDED';

export interface RecordSecurityEventParams {
  merchantId: string;
  organizationId?: string;
  actorId: string;
  actorType: 'USER' | 'API_KEY' | 'WORKER' | 'SYSTEM' | 'ANONYMOUS' | 'WEBHOOK';
  actorName?: string;
  actorEmail?: string;
  action: SecurityActionType | string;
  entityType: string;
  entityId: string;
  details?: Record<string, any> | string;
  requestId?: string;
  sessionId?: string;
  severity?: AuditSeverity;
  category?: AuditCategory;
  result?: AuditResult;
}

export class SecurityEventService {
  /**
   * Records a security-critical audit event.
   * Enforces deep sanitization to ensure no plaintext secrets or credentials enter the audit trail.
   */
  static async recordSecurityEvent(params: RecordSecurityEventParams) {
    const orgId = params.organizationId || params.merchantId;
    const detailsObj = typeof params.details === 'object' ? params.details : { message: params.details };
    const sanitizedDetails = redactSensitiveObject(detailsObj);

    // Determine category
    let category: AuditCategory = params.category || 'SECURITY';
    if (params.action.startsWith('AUTH_MFA')) {
      category = 'MFA';
    } else if (params.action.startsWith('AUTH_SESSION')) {
      category = 'SESSION';
    } else if (params.action.startsWith('AUTH_') || params.action.includes('LOGIN') || params.action.includes('PASSWORD')) {
      category = 'AUTHENTICATION';
    } else if (params.action.startsWith('API_KEY')) {
      category = 'API';
    } else if (params.action.startsWith('ORG') || params.action.includes('ROLE')) {
      category = 'ORGANIZATION';
    }

    // Determine severity
    let severity: AuditSeverity = params.severity || 'INFO';
    if (params.action.includes('FAILURE') || params.action.includes('REJECTED')) {
      severity = 'LOW';
    }
    if (params.action.includes('DISABLED') || params.action.includes('REVOKED') || params.action.includes('ROLE_CHANGED')) {
      severity = 'HIGH';
    }
    if (params.action.includes('LIVE_EXECUTION') || params.action.includes('OWNER_TRANSFERRED')) {
      severity = 'CRITICAL';
    }

    const result: AuditResult = params.result || (params.action.includes('FAILURE') ? 'FAILURE' : 'SUCCESS');

    // Record directly through central AuditService
    await AuditService.record({
      organizationId: orgId,
      merchantId: params.merchantId,
      actor: {
        type: params.actorType as ActorType,
        id: params.actorId,
        displayName: params.actorName,
        email: params.actorEmail,
      },
      action: params.action,
      category,
      severity,
      result,
      resource: {
        type: params.entityType,
        id: params.entityId,
      },
      requestId: params.requestId,
      sessionId: params.sessionId,
      metadata: sanitizedDetails,
    });

    return AuditService.logEvent({
      merchantId: params.merchantId,
      actorType: params.actorType,
      actorName: params.actorName || params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      details: typeof params.details === 'object' ? JSON.stringify(sanitizedDetails) : params.details || '',
    });
  }

  static async emitSecurityEvent(params: any) {
    return this.recordSecurityEvent({
      merchantId: params.merchantId,
      organizationId: params.organizationId,
      actorId: params.actorId,
      actorType: params.actorType || 'USER',
      actorName: params.actorName,
      action: params.eventType || params.action || 'SECURITY_SETTING_CHANGED',
      entityType: params.entityType || 'SECURITY',
      entityId: params.entityId || params.actorId,
      details: params.description || params.metadata,
      requestId: params.requestId,
    });
  }
}
