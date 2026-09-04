export type RazorpayEnvironment = 'TEST' | 'LIVE';

export type PaymentProviderAccountStatus = 'ACTIVE' | 'SUSPENDED' | 'DISCONNECTED';

export interface RazorpayCredentials {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  environment: RazorpayEnvironment;
}

export interface PaymentProviderAccount {
  id: string;
  merchantId: string;
  provider: 'RAZORPAY';
  environment: RazorpayEnvironment;
  status: PaymentProviderAccountStatus;
  credentialsRef: string; // Reference in SecretStore (never plaintext in DB)
  accountName?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export type PaymentProviderErrorCode =
  | 'INVALID_REQUEST'
  | 'AUTHENTICATION_FAILED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_NOT_FOUND'
  | 'PROVIDER_UNAVAILABLE'
  | 'INVALID_STATE'
  | 'UNKNOWN_PROVIDER_ERROR';

export type ErrorClassification = 'TRANSIENT' | 'PERMANENT' | 'AUTHENTICATION_FAILED';

export interface RazorpayOrderInput {
  amount: number; // in paise
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResponse {
  id: string;
  entity: 'order';
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt?: string;
  status: 'created' | 'attempted' | 'paid';
  created_at: number;
}

export interface RazorpayPaymentResponse {
  id: string;
  entity: 'payment';
  amount: number;
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  order_id?: string;
  method?: string;
  description?: string;
  error_code?: string;
  error_description?: string;
  error_source?: string;
  error_step?: string;
  error_reason?: string;
  bank?: string;
  wallet?: string;
  vpa?: string;
  email?: string;
  contact?: string;
  created_at: number;
}

export interface RazorpayPaymentLinkInput {
  amount: number; // in paise
  currency?: string;
  description: string;
  reference_id?: string;
  customer?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notify?: {
    sms?: boolean;
    whatsapp?: boolean;
    email?: boolean;
  };
  reminder_enable?: boolean;
  notes?: Record<string, any>;
}

export interface RazorpayPaymentLinkResponse {
  id: string;
  entity: 'payment_link';
  short_url: string;
  status: 'created' | 'partially_paid' | 'paid' | 'cancelled' | 'expired';
  amount: number;
  amount_paid: number;
  currency: string;
  description: string;
  reference_id?: string;
  created_at: number;
}
