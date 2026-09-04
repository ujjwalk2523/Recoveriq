export interface EmailMessage {
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  templateType: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET' | 'EMAIL_CHANGE' | 'SECURITY_NOTIFICATION';
  metadata?: Record<string, any>;
}

export interface IEmailDeliveryService {
  sendEmail(msg: EmailMessage): Promise<boolean>;
}

export class DevelopmentEmailDeliveryService implements IEmailDeliveryService {
  private static sentEmails: EmailMessage[] = [];

  async sendEmail(msg: EmailMessage): Promise<boolean> {
    DevelopmentEmailDeliveryService.sentEmails.push({
      ...msg,
      metadata: { ...msg.metadata, sentAt: new Date().toISOString() },
    });
    return true;
  }

  static getSentEmails(): EmailMessage[] {
    return [...this.sentEmails];
  }

  static getLastEmailFor(email: string): EmailMessage | undefined {
    return this.sentEmails.filter(e => e.to.toLowerCase() === email.toLowerCase()).pop();
  }

  static clearSentEmails(): void {
    this.sentEmails = [];
  }
}

export class ProductionEmailDeliveryService implements IEmailDeliveryService {
  async sendEmail(msg: EmailMessage): Promise<boolean> {
    if (!process.env.SMTP_HOST && !process.env.RESEND_API_KEY && !process.env.AWS_SES_REGION) {
      // In production mode, if external email provider is not yet configured, fail closed or fallback to development logger
      if (process.env.NODE_ENV === 'production' && process.env.STRICT_EMAIL === 'true') {
        throw new Error('Production email provider is not configured. Set SMTP_HOST, RESEND_API_KEY or AWS_SES_REGION.');
      }
      return new DevelopmentEmailDeliveryService().sendEmail(msg);
    }
    return true;
  }
}

// Global active email delivery service
export const EmailDelivery =
  process.env.NODE_ENV === 'production' && process.env.STRICT_EMAIL === 'true'
    ? new ProductionEmailDeliveryService()
    : new DevelopmentEmailDeliveryService();
