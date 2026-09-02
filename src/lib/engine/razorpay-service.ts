export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  isLiveMode: boolean;
  webhookSecret: string;
}

export interface PaymentLinkResult {
  linkId: string;
  shortUrl: string;
  status: 'created' | 'paid' | 'expired';
  amount: number;
  customerName: string;
  customerPhone: string;
  createdAt: string;
}

export interface RetryExecutionResult {
  success: boolean;
  gatewayTransactionId: string;
  status: 'CAPTURED' | 'FAILED' | 'QUEUED' | 'LINK_SENT';
  message: string;
  executedAt: string;
  channel: string;
}

export class RazorpayGatewayService {
  private config: RazorpayConfig;

  constructor(config?: Partial<RazorpayConfig>) {
    this.config = {
      keyId: config?.keyId || process.env.RAZORPAY_KEY_ID || 'rzp_test_recoveriq_demo',
      keySecret: config?.keySecret || process.env.RAZORPAY_KEY_SECRET || 'secret_mock_demo_mode',
      isLiveMode: config?.isLiveMode ?? false,
      webhookSecret: config?.webhookSecret || 'whsec_demo_signature_123',
    };
  }

  public async createPaymentLink(params: {
    amount: number;
    currency?: string;
    description: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    referenceId: string;
  }): Promise<PaymentLinkResult> {
    const { amount, customerName, customerPhone, referenceId } = params;

    // In real mode with credentials: we could fetch from Razorpay API
    // In Demo Mode: produce a deterministic test link
    const linkId = `plink_${Math.random().toString(36).substring(2, 10)}`;
    const shortUrl = `https://rzp.io/i/rcvq_${referenceId.slice(-6).toLowerCase()}`;

    return {
      linkId,
      shortUrl,
      status: 'created',
      amount,
      customerName,
      customerPhone,
      createdAt: new Date().toISOString(),
    };
  }

  public async executeRecoveryAction(params: {
    transactionId: string;
    actionType: string;
    amount: number;
    customerPhone: string;
  }): Promise<RetryExecutionResult> {
    const { transactionId, actionType, amount } = params;
    const now = new Date().toISOString();
    const gatewayTxnId = `pay_${Math.random().toString(36).substring(2, 12)}`;

    // Realistic probabilistic simulation for execution
    if (actionType === 'IMMEDIATE_RETRY') {
      const isSuccess = Math.random() < 0.85; // 85% success on transient
      return {
        success: isSuccess,
        gatewayTransactionId: gatewayTxnId,
        status: isSuccess ? 'CAPTURED' : 'FAILED',
        message: isSuccess
          ? `Payment of ₹${amount.toLocaleString('en-IN')} successfully captured via Razorpay Switch.`
          : 'Gateway retry returned secondary timeout: ISSUER_UNAVAILABLE.',
        executedAt: now,
        channel: 'Razorpay Direct Gateway API',
      };
    }

    if (actionType === 'WHATSAPP_NUDGE') {
      return {
        success: true,
        gatewayTransactionId: gatewayTxnId,
        status: 'LINK_SENT',
        message: `Interactive WhatsApp template with 1-tap UPI button dispatched to customer. Session TTL: 24h.`,
        executedAt: now,
        channel: 'Meta WhatsApp Business Cloud API',
      };
    }

    if (actionType === 'PAYMENT_LINK') {
      return {
        success: true,
        gatewayTransactionId: gatewayTxnId,
        status: 'LINK_SENT',
        message: `Dynamic multi-rail payment link generated and delivered via SMS & Email.`,
        executedAt: now,
        channel: 'Razorpay Payment Links + Gupshup SMS',
      };
    }

    if (actionType === 'OPTIMAL_DELAYED_RETRY') {
      return {
        success: true,
        gatewayTransactionId: gatewayTxnId,
        status: 'QUEUED',
        message: `Scheduled silent debit registered in RecoverIQ Redis Queue. Execution scheduled for 09:30 AM IST.`,
        executedAt: now,
        channel: 'RecoverIQ BullMQ Scheduler',
      };
    }

    if (actionType === 'MANDATE_UPDATE') {
      return {
        success: true,
        gatewayTransactionId: gatewayTxnId,
        status: 'LINK_SENT',
        message: `NPCI eNACH mandate modification link sent to customer for re-authentication.`,
        executedAt: now,
        channel: 'Razorpay Subscriptions eNACH Rail',
      };
    }

    return {
      success: true,
      gatewayTransactionId: gatewayTxnId,
      status: 'QUEUED',
      message: `Human escalation ticket created and assigned to VIP billing concierge.`,
      executedAt: now,
      channel: 'Zendesk / Internal Desk',
    };
  }
}

export const razorpayService = new RazorpayGatewayService();
