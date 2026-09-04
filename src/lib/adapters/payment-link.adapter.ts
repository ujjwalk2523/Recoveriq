import { ActionAdapter, AdapterExecutionRequest, AdapterExecutionResponse } from './adapter-types';
import { RecoveryActionType } from '../engine/types';
import { getRazorpayClient } from '../payments/razorpay/client';
import { normalizeRazorpayError } from '../payments/razorpay/errors';

export class PaymentLinkAdapter implements ActionAdapter {
  name = 'MultiRailPaymentLinkAdapter';
  channel = 'PAYMENT_LINK';

  canHandle(actionType: RecoveryActionType): boolean {
    return actionType === 'PAYMENT_LINK' || actionType === 'MANDATE_UPDATE';
  }

  async execute(request: AdapterExecutionRequest): Promise<AdapterExecutionResponse> {
    console.log(`[PaymentLinkAdapter] Creating payment link for ₹${request.amount} to ${request.customerPhone} (IdempotencyKey: ${request.idempotencyKey})`);

    try {
      const client = await getRazorpayClient({ merchantId: request.merchantId });

      const link = await client.createPaymentLink({
        amount: request.amount,
        currency: request.currency || 'INR',
        description: `RecoverIQ Recovery Payment #${request.transactionId.slice(-6)}`,
        customer: {
          name: request.customerName || 'Valued Customer',
          email: request.customerEmail || 'customer@example.in',
          contact: request.customerPhone,
        },
        notify: {
          sms: true,
          email: true,
        },
        reminder_enable: true,
        notes: {
          transactionId: request.transactionId,
          sequenceId: request.sequenceId,
          stepNumber: String(request.stepNumber),
          idempotencyKey: request.idempotencyKey,
        },
      });

      return {
        success: true,
        provider: 'RAZORPAY',
        providerReference: link.id,
        channel: 'PAYMENT_LINK',
        costINR: 3.20,
        status: 'DISPATCHED',
        message: `Payment link created: ${link.short_url}`,
        rawResponse: link as any,
      };
    } catch (err: any) {
      const normalized = normalizeRazorpayError(err);
      console.warn(`[PaymentLinkAdapter] Error generating payment link:`, normalized.message);
      return {
        success: false,
        provider: 'RAZORPAY',
        providerReference: `plink_err_${Date.now()}`,
        channel: 'PAYMENT_LINK',
        costINR: 0.0,
        status: 'FAILED',
        message: normalized.message,
      };
    }
  }
}
