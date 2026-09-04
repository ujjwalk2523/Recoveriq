import { logger, redactSecret } from '../observability/logger';

export interface SendInvitationEmailParams {
  toEmail: string;
  organizationName: string;
  inviterName?: string;
  role: string;
  inviteLink: string;
  expiresAt: Date;
}

export interface SendSecurityNotificationParams {
  toEmail: string;
  subject: string;
  message: string;
  organizationName: string;
  metadata?: Record<string, any>;
}

export interface IEmailProvider {
  sendInvitation(params: SendInvitationEmailParams): Promise<{ success: boolean; messageId?: string }>;
  sendSecurityNotification(params: SendSecurityNotificationParams): Promise<{ success: boolean; messageId?: string }>;
}

/**
 * High-fidelity in-memory and console email provider for test execution and local development.
 * Never leaks raw secrets, credentials, or sensitive tokens.
 */
export class ConsoleEmailProvider implements IEmailProvider {
  public static sentInvitations: SendInvitationEmailParams[] = [];
  public static sentSecurityNotifications: SendSecurityNotificationParams[] = [];

  async sendInvitation(params: SendInvitationEmailParams): Promise<{ success: boolean; messageId: string }> {
    ConsoleEmailProvider.sentInvitations.push(params);

    logger.info(`[EmailProvider] Sent invitation email to ${params.toEmail} for organization '${params.organizationName}' (Role: ${params.role})`, {
      toEmail: params.toEmail,
      organizationName: params.organizationName,
      role: params.role,
      expiresAt: params.expiresAt.toISOString(),
    });

    return {
      success: true,
      messageId: `msg_invite_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    };
  }

  async sendSecurityNotification(params: SendSecurityNotificationParams): Promise<{ success: boolean; messageId: string }> {
    ConsoleEmailProvider.sentSecurityNotifications.push(params);

    logger.warn(`[EmailProvider] Security notification to ${params.toEmail}: ${params.subject}`, {
      toEmail: params.toEmail,
      subject: params.subject,
      organizationName: params.organizationName,
    });

    return {
      success: true,
      messageId: `msg_sec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    };
  }

  static clear(): void {
    ConsoleEmailProvider.sentInvitations.length = 0;
    ConsoleEmailProvider.sentSecurityNotifications.length = 0;
  }
}

export class InMemoryEmailProvider extends ConsoleEmailProvider {
  public sentEmails: any[] = [];
  async sendInvitation(params: SendInvitationEmailParams): Promise<{ success: boolean; messageId: string }> {
    this.sentEmails.push(params);
    return super.sendInvitation(params);
  }
}

// Singleton email provider instance
let emailProviderInstance: IEmailProvider = new ConsoleEmailProvider();

export function getEmailProvider(): IEmailProvider {
  return emailProviderInstance;
}

export function setEmailProvider(provider: IEmailProvider): void {
  emailProviderInstance = provider;
}
