import { RecoveryActionType } from '../engine/types';

export interface AdapterExecutionRequest {
  merchantId?: string;
  transactionId: string;
  sequenceId: string;
  stepNumber: number;
  actionType: RecoveryActionType;
  amount: number;
  currency?: string;
  customerPhone: string;
  customerEmail?: string;
  customerName?: string;
  idempotencyKey: string;
  metadata?: Record<string, any>;
}

export interface AdapterExecutionResponse {
  success: boolean;
  provider: string; // 'RAZORPAY', 'WHATSAPP_META', 'PINPOINT', 'TWILIO'
  providerReference: string; // payment ID, link ID, message ID
  channel: string; // 'GATEWAY_RETRY', 'PAYMENT_LINK', 'WHATSAPP', 'HUMAN_ESCALATION'
  costINR: number;
  status: 'DISPATCHED' | 'CAPTURED' | 'FAILED' | 'PENDING';
  message: string;
  rawResponse?: Record<string, any>;
}

export interface ActionAdapter {
  name: string;
  channel: string;
  canHandle(actionType: RecoveryActionType): boolean;
  execute(request: AdapterExecutionRequest): Promise<AdapterExecutionResponse>;
}
