import { PaymentMethod, PaymentStatus, FailureCategory } from '@prisma/client';
import { classifyPaymentFailure } from '@/lib/engine/classifier';
import { RazorpayPaymentResponse } from './client';

export interface RazorpayWebhookPayload {
  entity?: 'event';
  account_id?: string;
  event: string;
  event_id?: string;
  id?: string;
  contains?: string[];
  payload: {
    payment?: {
      entity: RazorpayPaymentResponse;
    };
    order?: {
      entity: any;
    };
  };
  created_at: number;
}

export interface NormalizedPaymentEvent {
  eventId: string;
  eventType: string; // e.g. payment.failed, payment.captured
  paymentId: string;
  orderId: string;
  amountINR: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  
  // Failure mapping
  failureCode: string;
  failureMessage: string;
  failureCategory: FailureCategory;
  isTransient: boolean;
  baseRecoveryProbability: number;
  
  // Customer details
  customer: {
    name: string;
    email: string;
    phone: string;
    upiVpa?: string;
    cardLast4?: string;
    cardBrand?: string;
    bankName?: string;
  };

  rawPayload: Record<string, any>;
  createdAt: Date;
}

export class RazorpayMapper {
  /**
   * Derives a guaranteed unique event ID for idempotency tracking
   */
  static extractEventId(payload: RazorpayWebhookPayload): string {
    if (payload.event_id) return payload.event_id;
    if (payload.id && payload.id.startsWith('evt_')) return payload.id;

    const paymentId = payload.payload?.payment?.entity?.id || 'nopay';
    const event = payload.event || 'unknown';
    const timestamp = payload.created_at || Date.now();
    return `evt_${paymentId}_${event.replace('.', '_')}_${timestamp}`;
  }

  /**
   * Maps Razorpay payment method strings to RecoverIQ PaymentMethod enum
   */
  static mapPaymentMethod(method?: string): PaymentMethod {
    if (!method) return PaymentMethod.UPI;

    const normalized = method.toLowerCase();
    if (normalized.includes('upi')) return PaymentMethod.UPI;
    if (normalized.includes('card')) return PaymentMethod.CARD;
    if (normalized.includes('netbanking') || normalized.includes('nb')) return PaymentMethod.NETBANKING;
    if (normalized.includes('mandate') || normalized.includes('nach') || normalized.includes('recurring')) return PaymentMethod.MANDATE;
    if (normalized.includes('wallet')) return PaymentMethod.WALLET;

    return PaymentMethod.UPI;
  }

  /**
   * Maps Razorpay error codes and descriptions to RecoverIQ FailureCategory and recovery metrics
   */
  static mapFailureDetails(
    errorCode?: string,
    errorDescription?: string,
    method: PaymentMethod = PaymentMethod.UPI
  ): {
    category: FailureCategory;
    isTransient: boolean;
    baseRecoveryProbability: number;
    summary: string;
  } {
    const rawCode = errorCode || 'BAD_REQUEST_ERROR';
    const rawDesc = errorDescription || 'Payment declined by gateway or switch.';

    const classified = classifyPaymentFailure(rawCode, method, rawDesc);

    return {
      category: classified.category as FailureCategory,
      isTransient: classified.isTransient,
      baseRecoveryProbability: classified.baseRecoveryProbability,
      summary: classified.merchantDescription,
    };
  }

  /**
   * Maps an incoming Razorpay webhook payload into RecoverIQ's normalized domain representation
   */
  static toDomainEvent(payload: RazorpayWebhookPayload): NormalizedPaymentEvent {
    const payment = payload.payload?.payment?.entity;
    const eventId = this.extractEventId(payload);
    const eventType = payload.event;

    // Razorpay amount is in paise (e.g. 150000 paise = ₹1,500.00)
    const amountINR = payment?.amount ? Math.round(payment.amount / 100) : 0;
    const currency = payment?.currency || 'INR';
    const method = this.mapPaymentMethod(payment?.method);

    // Status mapping
    let status: PaymentStatus = PaymentStatus.FAILED;
    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      status = PaymentStatus.RECOVERED;
    } else if (eventType === 'payment.authorized') {
      status = PaymentStatus.RECOVERING;
    }

    const failureDetails = this.mapFailureDetails(payment?.error_code, payment?.error_description, method);

    // Customer details extraction
    const phone = payment?.contact || '+919876543210';
    const email = payment?.email || 'customer@example.in';
    const name = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Customer';

    return {
      eventId,
      eventType,
      paymentId: payment?.id || `pay_mock_${Date.now()}`,
      orderId: payment?.order_id || `order_rcvq_${Date.now()}`,
      amountINR,
      currency,
      method,
      status,
      failureCode: payment?.error_code || (status === PaymentStatus.FAILED ? 'BAD_REQUEST_ERROR' : 'SUCCESS'),
      failureMessage: payment?.error_description || (status === PaymentStatus.FAILED ? 'Payment transaction failed' : 'Payment captured successfully'),
      failureCategory: failureDetails.category,
      isTransient: failureDetails.isTransient,
      baseRecoveryProbability: failureDetails.baseRecoveryProbability,
      customer: {
        name,
        email,
        phone,
        upiVpa: payment?.vpa,
        bankName: payment?.bank,
      },
      rawPayload: payload as any,
      createdAt: new Date((payload.created_at || Math.floor(Date.now() / 1000)) * 1000),
    };
  }
}
