export interface TransactionFeatureVector {
  // Transaction Level
  amount: number;
  payment_method: string;
  failure_category: string;
  failure_code: string;
  hour: number; // 0..23
  day_of_week: number; // 0..6 (0=Sun, 6=Sat)
  time_since_last_payment_minutes: number; // minutes elapsed or -1 if first payment

  // Customer Level
  customer_transaction_count: number;
  customer_success_rate: number; // 0.0..1.0
  customer_recovery_rate: number; // 0.0..1.0
  upi_success_rate: number; // 0.0..1.0
  card_success_rate: number; // 0.0..1.0
  avg_recovery_delay_minutes: number;
  previous_retry_count: number;
  previous_recovery_count: number;
  fatigue_score: number; // 0..100
  risk_score: number; // 0..100

  // Merchant / Platform Level
  merchant_recovery_rate: number; // 0.0..1.0

  // Optional Labels / Targets for ML Dataset (when transaction reaches final state)
  target_recovered?: number; // 1 = recovered, 0 = permanent failure
  target_recovery_channel?: string; // GATEWAY_RETRY, PAYMENT_LINK, WHATSAPP, etc.
  target_time_to_recover_minutes?: number; // minutes taken to recover or null
}

export interface FeatureExtractionMetadata {
  transactionId: string;
  customerId: string;
  merchantId: string;
  extractedAt: string;
  isFallback: boolean;
}

export interface FeatureRecord {
  metadata: FeatureExtractionMetadata;
  features: TransactionFeatureVector;
}
