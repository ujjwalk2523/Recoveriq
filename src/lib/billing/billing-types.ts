export enum Feature {
  BASIC_ANALYTICS = 'BASIC_ANALYTICS',
  AUTONOMOUS_RECOVERY = 'AUTONOMOUS_RECOVERY',
  ML_OPTIMIZATION = 'ML_OPTIMIZATION',
  CONTEXTUAL_BANDIT = 'CONTEXTUAL_BANDIT',
  EXPERIMENTS = 'EXPERIMENTS',
  API_ACCESS = 'API_ACCESS',
  ADVANCED_INTELLIGENCE = 'ADVANCED_INTELLIGENCE',
  CUSTOM_POLICIES = 'CUSTOM_POLICIES',
  TEAM_MANAGEMENT = 'TEAM_MANAGEMENT',
  PRIORITY_SUPPORT = 'PRIORITY_SUPPORT',
  ENTERPRISE_CONTROLS = 'ENTERPRISE_CONTROLS',
}

export enum PlanCode {
  STARTER = 'STARTER',
  GROWTH = 'GROWTH',
  SCALE = 'SCALE',
  ENTERPRISE = 'ENTERPRISE',
}

export enum SubscriptionStatusType {
  TRIALING = 'TRIALING',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELLED = 'CANCELLED',
  SUSPENDED = 'SUSPENDED',
  EXPIRED = 'EXPIRED',
}

export enum BillingProvider {
  INTERNAL = 'INTERNAL',
  RAZORPAY = 'RAZORPAY',
  STRIPE = 'STRIPE',
}

export enum SubscriptionEventType {
  CREATED = 'CREATED',
  TRIAL_STARTED = 'TRIAL_STARTED',
  ACTIVATED = 'ACTIVATED',
  PLAN_CHANGED = 'PLAN_CHANGED',
  PAST_DUE = 'PAST_DUE',
  CANCELLED = 'CANCELLED',
  REACTIVATED = 'REACTIVATED',
  SUSPENDED = 'SUSPENDED',
  EXPIRED = 'EXPIRED',
}

export enum OveragePolicy {
  BLOCK = 'BLOCK',
  ALLOW_WITH_OVERAGE = 'ALLOW_WITH_OVERAGE',
  ALLOW_UNTIL_HARD_LIMIT = 'ALLOW_UNTIL_HARD_LIMIT',
}

export interface OverageRates {
  transactionsPerUnitMinor: number; // e.g. 50 paise per transaction
  recoveryAttemptsPerUnitMinor: number; // e.g. 100 paise per attempt
  apiRequestsPerUnitMinor: number; // e.g. 10 paise per API call
}

export interface PlanDefinition {
  id?: string;
  code: PlanCode;
  name: string;
  description: string;
  monthlyPriceMinor: number; // In paise (e.g. 799900 = ₹7,999.00), -1 for custom/contact sales
  annualPriceMinor?: number; // In paise
  currency: string;
  includedTransactions: number; // -1 for unlimited
  includedRecoveryAttempts: number; // -1 for unlimited
  includedApiRequests: number; // -1 for unlimited
  includedMembers?: number; // Seat limit (-1 for unlimited)
  includedTeams?: number; // Team limit (-1 for unlimited)
  features: Record<Feature, boolean>;
  overagePolicy: OveragePolicy;
  overageRates: OverageRates;
  trialEligibility: boolean;
  active: boolean;
}

export interface SubscriptionData {
  id: string;
  merchantId: string;
  planId?: string | null;
  planCode: PlanCode;
  status: SubscriptionStatusType;
  provider: BillingProvider;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date | null;
  trialEnd?: Date | null;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: Date | null;
  suspendedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionEventData {
  id: string;
  subscriptionId: string;
  merchantId: string;
  eventType: SubscriptionEventType;
  previousPlan?: PlanCode | null;
  newPlan?: PlanCode | null;
  previousStatus?: SubscriptionStatusType | null;
  newStatus?: SubscriptionStatusType | null;
  actor: string;
  metadata?: Record<string, any> | null;
  createdAt: Date;
}

export interface MerchantEntitlements {
  merchantId: string;
  planCode: PlanCode;
  status: SubscriptionStatusType;
  isSubscriptionValid: boolean;
  features: Record<Feature, boolean>;
  limits: {
    maxMonthlyTransactions: number;
    maxMonthlyRecoveryAttempts: number;
    maxMonthlyApiRequests: number;
  };
}

export interface PlanUsageStats {
  transactionsCount: number;
  transactionsLimit: number;
  recoveryAttemptsCount: number;
  recoveryAttemptsLimit: number;
  apiRequestsCount: number;
  apiRequestsLimit: number;
}

export enum UsageMetric {
  TRANSACTIONS_PROCESSED = 'TRANSACTIONS_PROCESSED',
  RECOVERY_ATTEMPTS = 'RECOVERY_ATTEMPTS',
  API_REQUESTS = 'API_REQUESTS',
  PAYMENT_LINKS_CREATED = 'PAYMENT_LINKS_CREATED',
  WHATSAPP_MESSAGES = 'WHATSAPP_MESSAGES',
  RECOVERED_TRANSACTIONS = 'RECOVERED_TRANSACTIONS',
  RECOVERED_REVENUE = 'RECOVERED_REVENUE',
}

export enum UsageStatus {
  WITHIN_LIMIT = 'WITHIN_LIMIT',
  NEAR_LIMIT = 'NEAR_LIMIT',
  LIMIT_REACHED = 'LIMIT_REACHED',
  OVER_LIMIT = 'OVER_LIMIT',
}

export interface UsageLedgerRecord {
  id: string;
  merchantId: string;
  subscriptionId?: string | null;
  metric: UsageMetric;
  quantity: number;
  unit: string;
  amountMinor?: number | bigint | null;
  currency: string;
  source: string;
  sourceId: string;
  idempotencyKey: string;
  periodStart: Date;
  periodEnd: Date;
  metadata?: Record<string, any> | null;
  occurredAt: Date;
  createdAt: Date;
  isCorrection?: boolean;
  originalEntryId?: string | null;
  correctionReason?: string | null;
}

export interface RecordUsageParams {
  merchantId: string;
  metric: UsageMetric;
  quantity?: number;
  unit?: string;
  amountMinor?: number | bigint;
  currency?: string;
  source: string;
  sourceId: string;
  idempotencyKey?: string;
  occurredAt?: Date | string;
  metadata?: Record<string, any>;
}

export interface RecordCorrectionParams {
  merchantId: string;
  originalEntryId: string;
  quantityDelta: number;
  reason: string;
  actor: string;
  occurredAt?: Date | string;
  metadata?: Record<string, any>;
}

export interface UsageMetricSummary {
  metric: UsageMetric;
  used: number;
  included: number;
  remaining: number;
  overage: number;
  utilization: number;
  status: UsageStatus;
  unit: string;
  amountMinor?: number;
}

export interface UsageSummaryResponse {
  merchantId: string;
  subscriptionId?: string;
  planCode: PlanCode;
  period: {
    start: string;
    end: string;
  };
  metrics: Record<string, UsageMetricSummary>;
}

// -----------------------------------------------------------------------------
// Phase 7.5 Production SaaS Invoices & Provider Contracts
// -----------------------------------------------------------------------------

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  PAID = 'PAID',
  PAST_DUE = 'PAST_DUE',
  VOID = 'VOID',
  UNCOLLECTIBLE = 'UNCOLLECTIBLE',
}

export enum InvoiceLineItemType {
  BASE_SUBSCRIPTION = 'BASE_SUBSCRIPTION',
  OVERAGE = 'OVERAGE',
  ADD_ON = 'ADD_ON',
  CREDIT = 'CREDIT',
  DISCOUNT = 'DISCOUNT',
  TAX = 'TAX',
}

export interface InvoiceLineItemData {
  id: string;
  invoiceId: string;
  type: InvoiceLineItemType;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  totalMinor: number;
  metric?: string | null;
  usageMeasured?: number | null;
  usageIncluded?: number | null;
  metadata?: Record<string, any> | null;
  createdAt: Date;
}

export interface InvoiceData {
  id: string;
  merchantId: string;
  subscriptionId?: string | null;
  providerInvoiceId?: string | null;
  invoiceNumber: string;
  status: InvoiceStatus;
  currency: string;
  subtotalMinor: number;
  taxMinor: number;
  discountMinor: number;
  overageMinor: number;
  totalMinor: number;
  amountPaidMinor: number;
  amountDueMinor: number;
  periodStart: Date;
  periodEnd: Date;
  issuedAt: Date;
  dueAt?: Date | null;
  paidAt?: Date | null;
  isTestMode: boolean;
  metadata?: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
  lineItems: InvoiceLineItemData[];
}

export interface CreateCustomerParams {
  merchantId: string;
  name: string;
  email: string;
  phone?: string;
}

export interface ProviderCustomer {
  providerCustomerId: string;
  provider: BillingProvider;
  merchantId: string;
}

export interface CreateCheckoutParams {
  merchantId: string;
  planCode: PlanCode;
  customerEmail: string;
  customerName: string;
  billingPeriod?: 'MONTHLY' | 'ANNUAL';
  successUrl?: string;
  cancelUrl?: string;
}

export interface ProviderCheckoutSession {
  sessionId: string;
  checkoutUrl: string;
  provider: BillingProvider;
  planCode: PlanCode;
  amountMinor: number;
  currency: string;
  isTestMode: boolean;
  expiresAt: Date;
}

export interface CreateSubscriptionParams {
  merchantId: string;
  planCode: PlanCode;
  providerCustomerId?: string;
  billingPeriod?: 'MONTHLY' | 'ANNUAL';
}

export interface ProviderSubscription {
  providerSubscriptionId: string;
  providerCustomerId?: string;
  provider: BillingProvider;
  planCode: PlanCode;
  status: SubscriptionStatusType;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  isTestMode: boolean;
}

export interface CancelSubscriptionParams {
  providerSubscriptionId: string;
  merchantId: string;
  atPeriodEnd?: boolean;
}

export interface ProviderWebhookEvent {
  id: string; // provider unique event ID for idempotency
  eventType: string; // provider specific, e.g. "subscription.charged"
  normalizedType: BillingEventType;
  merchantId?: string;
  providerSubscriptionId?: string;
  providerPaymentId?: string;
  providerInvoiceId?: string;
  amountMinor?: number;
  currency?: string;
  status?: string;
  isTestMode: boolean;
  rawPayload: Record<string, any>;
  occurredAt: Date;
}

export enum BillingEventType {
  CHECKOUT_COMPLETED = 'billing.checkout.completed',
  SUBSCRIPTION_CREATED = 'billing.subscription.created',
  SUBSCRIPTION_ACTIVATED = 'billing.subscription.activated',
  SUBSCRIPTION_CHARGED = 'billing.subscription.charged',
  SUBSCRIPTION_PAST_DUE = 'billing.subscription.past_due',
  SUBSCRIPTION_CANCELLED = 'billing.subscription.cancelled',
  SUBSCRIPTION_SUSPENDED = 'billing.subscription.suspended',
  PAYMENT_FAILED = 'billing.payment.failed',
  INVOICE_GENERATED = 'billing.invoice.generated',
  INVOICE_PAID = 'billing.invoice.paid',
}

