import { ActionAdapter, AdapterExecutionRequest, AdapterExecutionResponse } from './adapter-types';
import { RazorpayRetryAdapter } from './razorpay-retry.adapter';
import { PaymentLinkAdapter } from './payment-link.adapter';
import { WhatsAppAdapter } from './whatsapp.adapter';

export class ActionDispatcher {
  private static adapters: ActionAdapter[] = [
    new RazorpayRetryAdapter(),
    new PaymentLinkAdapter(),
    new WhatsAppAdapter(),
  ];

  /**
   * Registers a custom adapter (e.g. for future Stripe, Cashfree, Twilio integrations)
   */
  static registerAdapter(adapter: ActionAdapter) {
    this.adapters.unshift(adapter); // prioritize newly registered adapters
  }

  /**
   * Dispatches the requested recovery action to the matching channel adapter
   */
  static async dispatch(request: AdapterExecutionRequest): Promise<AdapterExecutionResponse> {
    if (request.actionType === 'DO_NOT_RECOVER') {
      return {
        success: true,
        provider: 'RECOVERIQ_SUPPRESSION',
        providerReference: `suppress_${Date.now()}`,
        channel: 'DO_NOT_RECOVER',
        costINR: 0.0,
        status: 'DISPATCHED',
        message: 'Suppression enforced: Zero recovery actions dispatched.',
      };
    }

    const adapter = this.adapters.find(a => a.canHandle(request.actionType));

    if (!adapter) {
      console.warn(`[ActionDispatcher] No adapter found for action ${request.actionType}, falling back to PaymentLinkAdapter.`);
      const fallback = new PaymentLinkAdapter();
      return fallback.execute(request);
    }

    return adapter.execute(request);
  }
}
