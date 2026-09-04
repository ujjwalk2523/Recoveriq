import crypto from 'crypto';
import {
  BillingProvider,
  BillingEventType,
  CreateCustomerParams,
  ProviderCustomer,
  CreateCheckoutParams,
  ProviderCheckoutSession,
  CreateSubscriptionParams,
  ProviderSubscription,
  CancelSubscriptionParams,
  ProviderWebhookEvent,
  SubscriptionStatusType,
  PlanCode,
} from '../billing-types';
import { PLANS_CONFIG } from '../plan-config';
import { IBillingProvider } from '../billing-provider';

export class RazorpayBillingProvider implements IBillingProvider {
  readonly provider = BillingProvider.RAZORPAY;
  readonly isTestMode = true;
  private readonly secretKey: string;
  private readonly webhookSecret: string;

  constructor(options?: { secretKey?: string; webhookSecret?: string }) {
    this.secretKey = options?.secretKey || process.env.RAZORPAY_BILLING_SECRET_KEY || 'rzp_test_billing_secret';
    this.webhookSecret =
      options?.webhookSecret || process.env.RAZORPAY_BILLING_WEBHOOK_SECRET || 'rzp_test_billing_whsec';
  }

  async createCustomer(params: CreateCustomerParams): Promise<ProviderCustomer> {
    const { merchantId, name, email } = params;
    const providerCustomerId = `cust_rzp_test_${merchantId.slice(-6)}_${Date.now().toString(36)}`;
    return {
      providerCustomerId,
      provider: this.provider,
      merchantId,
    };
  }

  async createCheckout(params: CreateCheckoutParams): Promise<ProviderCheckoutSession> {
    const { merchantId, planCode, customerEmail, billingPeriod = 'MONTHLY' } = params;
    const plan = PLANS_CONFIG[planCode];
    if (!plan) throw new Error(`Invalid plan code: ${planCode}`);

    const isAnnual = billingPeriod === 'ANNUAL';
    const amountMinor = isAnnual && plan.annualPriceMinor ? plan.annualPriceMinor : plan.monthlyPriceMinor;
    const sessionId = `cs_rzp_test_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    return {
      sessionId,
      checkoutUrl: `https://checkout.razorpay.com/v1/subscription/test?session=${sessionId}&plan=${planCode}&email=${encodeURIComponent(
        customerEmail
      )}`,
      provider: this.provider,
      planCode,
      amountMinor,
      currency: plan.currency,
      isTestMode: true,
      expiresAt,
    };
  }

  async createSubscription(params: CreateSubscriptionParams): Promise<ProviderSubscription> {
    const { merchantId, planCode, providerCustomerId } = params;
    const providerSubscriptionId = `sub_rzp_test_${merchantId.slice(-6)}_${Date.now().toString(36)}`;
    const now = new Date();
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    return {
      providerSubscriptionId,
      providerCustomerId: providerCustomerId || `cust_rzp_test_${merchantId.slice(-6)}`,
      provider: this.provider,
      planCode,
      status: SubscriptionStatusType.ACTIVE,
      currentPeriodStart: now,
      currentPeriodEnd: nextMonth,
      isTestMode: true,
    };
  }

  async cancelSubscription(params: CancelSubscriptionParams): Promise<ProviderSubscription> {
    const { providerSubscriptionId, atPeriodEnd = true } = params;
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);

    return {
      providerSubscriptionId,
      provider: this.provider,
      planCode: PlanCode.STARTER,
      status: atPeriodEnd ? SubscriptionStatusType.ACTIVE : SubscriptionStatusType.CANCELLED,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      isTestMode: true,
    };
  }

  async fetchSubscription(providerSubscriptionId: string): Promise<ProviderSubscription> {
    const now = new Date();
    const nextMonth = new Date(now);
    nextMonth.setDate(nextMonth.getDate() + 30);

    return {
      providerSubscriptionId,
      provider: this.provider,
      planCode: PlanCode.GROWTH,
      status: SubscriptionStatusType.ACTIVE,
      currentPeriodStart: now,
      currentPeriodEnd: nextMonth,
      isTestMode: true,
    };
  }

  verifyWebhookSignature(rawBody: string, signature: string, secret?: string): boolean {
    const key = secret || this.webhookSecret;
    if (!rawBody || !signature || !key) return false;

    const expectedSignature = crypto.createHmac('sha256', key).update(rawBody).digest('hex');

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  }

  parseWebhookEvent(rawBody: string, headers: Record<string, string>): ProviderWebhookEvent {
    let payload: any;
    try {
      payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    } catch {
      throw new Error('Invalid JSON payload in provider webhook');
    }

    const eventType = payload.event || 'unknown';
    const eventId = payload.id || headers['x-razorpay-event-id'] || `pevt_${Date.now()}`;

    let normalizedType: BillingEventType = BillingEventType.PAYMENT_FAILED;
    let providerSubscriptionId: string | undefined;
    let providerPaymentId: string | undefined;
    let providerInvoiceId: string | undefined;
    let amountMinor: number | undefined;
    let currency = 'INR';

    const subEntity = payload.payload?.subscription?.entity;
    const payEntity = payload.payload?.payment?.entity;
    const invEntity = payload.payload?.invoice?.entity;

    if (subEntity) {
      providerSubscriptionId = subEntity.id;
    }
    if (payEntity) {
      providerPaymentId = payEntity.id;
      amountMinor = payEntity.amount;
      currency = payEntity.currency || 'INR';
    }
    if (invEntity) {
      providerInvoiceId = invEntity.id;
    }

    switch (eventType) {
      case 'subscription.authenticated':
      case 'subscription.activated':
        normalizedType = BillingEventType.SUBSCRIPTION_ACTIVATED;
        break;
      case 'subscription.charged':
        normalizedType = BillingEventType.SUBSCRIPTION_CHARGED;
        break;
      case 'subscription.pending':
      case 'payment.failed':
        normalizedType = BillingEventType.PAYMENT_FAILED;
        break;
      case 'subscription.halted':
        normalizedType = BillingEventType.SUBSCRIPTION_SUSPENDED;
        break;
      case 'subscription.cancelled':
        normalizedType = BillingEventType.SUBSCRIPTION_CANCELLED;
        break;
      case 'invoice.paid':
        normalizedType = BillingEventType.INVOICE_PAID;
        break;
      default:
        if (eventType.includes('charged')) {
          normalizedType = BillingEventType.SUBSCRIPTION_CHARGED;
        } else if (eventType.includes('failed')) {
          normalizedType = BillingEventType.PAYMENT_FAILED;
        } else {
          normalizedType = BillingEventType.SUBSCRIPTION_ACTIVATED;
        }
        break;
    }

    const merchantId =
      payload.merchantId ||
      subEntity?.notes?.merchantId ||
      payEntity?.notes?.merchantId ||
      'mer_default';

    return {
      id: eventId,
      eventType,
      normalizedType,
      merchantId,
      providerSubscriptionId,
      providerPaymentId,
      providerInvoiceId,
      amountMinor,
      currency,
      status: subEntity?.status || payEntity?.status,
      isTestMode: true,
      rawPayload: payload,
      occurredAt: new Date(),
    };
  }
}
