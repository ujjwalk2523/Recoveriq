import { ActionAdapter, AdapterExecutionRequest, AdapterExecutionResponse } from './adapter-types';
import { RecoveryActionType } from '../engine/types';
import { getRazorpayClient } from '../payments/razorpay/client';
import { normalizeRazorpayError } from '../payments/razorpay/errors';

export class RazorpayRetryAdapter implements ActionAdapter {
  name = 'RazorpaySwitchRetryAdapter';
  channel = 'GATEWAY_RETRY';

  canHandle(actionType: RecoveryActionType): boolean {
    return actionType === 'IMMEDIATE_RETRY' || actionType === 'OPTIMAL_DELAYED_RETRY';
  }

  async execute(request: AdapterExecutionRequest): Promise<AdapterExecutionResponse> {
    const isImmediate = request.actionType === 'IMMEDIATE_RETRY';
    console.log(`[RazorpayRetryAdapter] Executing ${request.actionType} for ₹${request.amount} (IdempotencyKey: ${request.idempotencyKey})`);

    try {
      const client = await getRazorpayClient({ merchantId: request.merchantId });

      // In test mode / demo mode / production: create order with Razorpay
      const order = await client.createOrder({
        amount: request.amount,
        currency: request.currency || 'INR',
        receipt: `rcpt_retry_${request.transactionId.slice(-8)}`,
        notes: {
          transactionId: request.transactionId,
          sequenceId: request.sequenceId,
          stepNumber: String(request.stepNumber),
          idempotencyKey: request.idempotencyKey,
          retryType: isImmediate ? 'ZERO_DELAY_SWITCH' : 'OPTIMAL_DELAYED',
        },
      });

      return {
        success: true,
        provider: 'RAZORPAY',
        providerReference: order.id,
        channel: 'GATEWAY_RETRY',
        costINR: isImmediate ? 0.10 : 0.25,
        status: 'DISPATCHED',
        message: `${isImmediate ? 'Zero-delay' : 'Delayed'} switch retry dispatched to Razorpay (Order: ${order.id}).`,
        rawResponse: order as any,
      };
    } catch (err: any) {
      const normalized = normalizeRazorpayError(err);
      console.warn(`[RazorpayRetryAdapter] Failed to dispatch retry:`, normalized.message);
      return {
        success: false,
        provider: 'RAZORPAY',
        providerReference: `retry_err_${Date.now()}`,
        channel: 'GATEWAY_RETRY',
        costINR: 0.10,
        status: 'FAILED',
        message: normalized.message,
      };
    }
  }
}
