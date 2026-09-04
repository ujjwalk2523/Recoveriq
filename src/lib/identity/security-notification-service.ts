import { EmailDelivery } from './email-delivery-service';
import { SecurityEventService } from '@/lib/security/security-events';

export type SecurityNotificationType =
  | 'NEW_LOGIN_DEVICE'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET_COMPLETED'
  | 'MFA_ENABLED'
  | 'MFA_DISABLED'
  | 'MFA_RECOVERY_CODE_USED'
  | 'EMAIL_CHANGED'
  | 'SSO_IDENTITY_LINKED'
  | 'SESSION_REVOKED_ALL';

export interface SecurityNotificationParams {
  userId: string;
  userEmail: string;
  eventType: SecurityNotificationType;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export class SecurityNotificationService {
  private static readonly TITLES: Record<SecurityNotificationType, string> = {
    NEW_LOGIN_DEVICE: 'Security Alert: New login to your RecoverIQ account',
    PASSWORD_CHANGED: 'Security Alert: Your password was changed',
    PASSWORD_RESET_COMPLETED: 'Security Alert: Your password was reset',
    MFA_ENABLED: 'Security Alert: Two-factor authentication (MFA) was enabled',
    MFA_DISABLED: 'Security Alert: Two-factor authentication (MFA) was disabled',
    MFA_RECOVERY_CODE_USED: 'Security Alert: An MFA recovery code was used to access your account',
    EMAIL_CHANGED: 'Security Alert: Your primary email address was updated',
    SSO_IDENTITY_LINKED: 'Security Alert: An external SSO identity was linked to your account',
    SESSION_REVOKED_ALL: 'Security Alert: All active sessions were signed out',
  };

  /**
   * Dispatches a security notification without leaking sensitive credentials.
   */
  static async sendNotification(params: SecurityNotificationParams): Promise<boolean> {
    const subject = this.TITLES[params.eventType] || 'Security Alert: RecoverIQ Account Activity';
    const timestamp = new Date().toUTCString();

    const textBody = `
Hello,

This is a security alert regarding your RecoverIQ account (${params.userEmail}).

Event: ${this.TITLES[params.eventType]}
Time: ${timestamp}
${params.ip ? `IP Address: ${params.ip}` : ''}
${params.userAgent ? `Device: ${params.userAgent}` : ''}

If you performed this action, no further steps are required.
If you did NOT authorize this activity, please reset your password immediately and contact support@recoveriq.io.

— The RecoverIQ Security Team
`.trim();

    try {
      await EmailDelivery.sendEmail({
        to: params.userEmail,
        subject,
        textBody,
        templateType: 'SECURITY_NOTIFICATION',
        metadata: {
          userId: params.userId,
          eventType: params.eventType,
        },
      });

      await SecurityEventService.recordSecurityEvent({
        merchantId: 'system',
        actorId: params.userId,
        actorType: 'USER',
        action: 'SECURITY_NOTIFICATION_SENT' as any,
        entityType: 'AUTH',
        entityId: params.userId,
        details: {
          eventType: params.eventType,
          recipient: params.userEmail,
        },
      });

      return true;
    } catch {
      return false;
    }
  }
}
