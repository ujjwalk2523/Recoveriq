export interface RazorpayOrderInput {
  amount: number; // in paise (e.g. 10000 = ₹100.00)
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

export class RazorpayClient {
  private keyId: string;
  private keySecret: string;
  private baseUrl = 'https://api.razorpay.com/v1';

  constructor(keyId?: string, keySecret?: string) {
    this.keyId = keyId || process.env.RAZORPAY_KEY_ID || 'rzp_test_recoveriq_demo';
    this.keySecret = keySecret || process.env.RAZORPAY_KEY_SECRET || 'rzp_test_recoveriq_secret';
  }

  private get authHeader(): string {
    return 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
  }

  private isMockKey(): boolean {
    return (
      !this.keyId ||
      this.keyId === 'rzp_test_recoveriq_demo' ||
      this.keySecret === 'rzp_test_recoveriq_secret'
    );
  }

  /**
   * Create an Order in Razorpay
   */
  async createOrder(input: RazorpayOrderInput): Promise<RazorpayOrderResponse> {
    if (this.isMockKey()) {
      return {
        id: `order_${Math.random().toString(36).substring(2, 12)}`,
        entity: 'order',
        amount: input.amount,
        amount_paid: 0,
        amount_due: input.amount,
        currency: input.currency || 'INR',
        receipt: input.receipt,
        status: 'created',
        created_at: Math.floor(Date.now() / 1000),
      };
    }

    const res = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: input.amount,
        currency: input.currency || 'INR',
        receipt: input.receipt,
        notes: input.notes,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Razorpay createOrder failed: ${err.error?.description || res.statusText}`);
    }

    return res.json();
  }

  /**
   * Fetch an Order by ID
   */
  async fetchOrder(orderId: string): Promise<RazorpayOrderResponse> {
    if (this.isMockKey()) {
      return {
        id: orderId,
        entity: 'order',
        amount: 250000,
        amount_paid: 250000,
        amount_due: 0,
        currency: 'INR',
        status: 'paid',
        created_at: Math.floor(Date.now() / 1000) - 3600,
      };
    }

    const res = await fetch(`${this.baseUrl}/orders/${orderId}`, {
      headers: { Authorization: this.authHeader },
    });

    if (!res.ok) {
      throw new Error(`Razorpay fetchOrder failed for ${orderId}`);
    }

    return res.json();
  }

  /**
   * Fetch a Payment by ID
   */
  async fetchPayment(paymentId: string): Promise<RazorpayPaymentResponse> {
    if (this.isMockKey()) {
      return {
        id: paymentId,
        entity: 'payment',
        amount: 185000,
        currency: 'INR',
        status: 'captured',
        method: 'upi',
        created_at: Math.floor(Date.now() / 1000),
      };
    }

    const res = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
      headers: { Authorization: this.authHeader },
    });

    if (!res.ok) {
      throw new Error(`Razorpay fetchPayment failed for ${paymentId}`);
    }

    return res.json();
  }

  /**
   * Create a Payment Link (e.g. for WhatsApp / Email 1-click recovery)
   */
  async createPaymentLink(input: RazorpayPaymentLinkInput): Promise<RazorpayPaymentLinkResponse> {
    if (this.isMockKey()) {
      const plinkId = `plink_${Math.random().toString(36).substring(2, 12)}`;
      return {
        id: plinkId,
        entity: 'payment_link',
        short_url: `https://rzp.io/i/${plinkId.slice(-6)}`,
        status: 'created',
        amount: input.amount,
        amount_paid: 0,
        currency: input.currency || 'INR',
        description: input.description,
        reference_id: input.reference_id,
        created_at: Math.floor(Date.now() / 1000),
      };
    }

    const res = await fetch(`${this.baseUrl}/payment_links`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Razorpay createPaymentLink failed: ${err.error?.description || res.statusText}`);
    }

    return res.json();
  }
}

export const razorpayClient = new RazorpayClient();
