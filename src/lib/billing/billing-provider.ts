import {
  BillingProvider as BillingProviderType,
  CreateCustomerParams,
  ProviderCustomer,
  CreateCheckoutParams,
  ProviderCheckoutSession,
  CreateSubscriptionParams,
  ProviderSubscription,
  CancelSubscriptionParams,
  ProviderWebhookEvent,
} from './billing-types';

export interface IBillingProvider {
  readonly provider: BillingProviderType;
  readonly isTestMode: boolean;

  createCustomer(params: CreateCustomerParams): Promise<ProviderCustomer>;
  createCheckout(params: CreateCheckoutParams): Promise<ProviderCheckoutSession>;
  createSubscription(params: CreateSubscriptionParams): Promise<ProviderSubscription>;
  cancelSubscription(params: CancelSubscriptionParams): Promise<ProviderSubscription>;
  fetchSubscription(providerSubscriptionId: string): Promise<ProviderSubscription>;
  verifyWebhookSignature(rawBody: string, signature: string, secret?: string): boolean;
  parseWebhookEvent(rawBody: string, headers: Record<string, string>): ProviderWebhookEvent;
}

let defaultProvider: IBillingProvider | null = null;

export function setBillingProvider(provider: IBillingProvider): void {
  defaultProvider = provider;
}

export function getBillingProvider(): IBillingProvider {
  if (!defaultProvider) {
    const { RazorpayBillingProvider } = require('./providers/razorpay-billing-provider');
    defaultProvider = new RazorpayBillingProvider();
  }
  return defaultProvider!;
}
