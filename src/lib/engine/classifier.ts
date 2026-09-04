import { FailureCategory, PaymentMethod, RecoveryActionType } from './types';

export type FailureSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RecoverabilityLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'ZERO';

export interface FailureDiagnosis {
  category: FailureCategory;
  standardCode: string;
  gatewayCode: string;
  severity: FailureSeverity;
  recoverability: RecoverabilityLevel;
  recommendedChannels: RecoveryActionType[];
  avoidChannels: RecoveryActionType[];
  reasoning: string;
  merchantDescription: string;
  technicalDescription: string;
  isTransient: boolean;
  requiresCustomerAction: boolean;
  isPermanentOrFraud: boolean;
  baseRecoveryProbability: number;
}

// Backwards-compatible type alias
export type ClassifiedFailure = FailureDiagnosis;

export const FAILURE_CATALOG: Record<string, FailureDiagnosis> = {
  'BAD_REQUEST_ERROR': {
    category: 'TECHNICAL',
    standardCode: 'GATEWAY_BAD_REQUEST',
    gatewayCode: 'BAD_REQUEST_ERROR',
    severity: 'LOW',
    recoverability: 'HIGH',
    recommendedChannels: ['IMMEDIATE_RETRY', 'OPTIMAL_DELAYED_RETRY'],
    avoidChannels: ['WHATSAPP_NUDGE'],
    reasoning: 'Transient handshake or network jitter between gateway and card/UPI switch. Rapid retry has 82% resolution.',
    technicalDescription: 'Gateway validation error or temporary communication handshake failure.',
    merchantDescription: 'Temporary gateway handshake failure with NPCI / Switch.',
    isTransient: true,
    requiresCustomerAction: false,
    isPermanentOrFraud: false,
    baseRecoveryProbability: 0.82,
  },
  'GATEWAY_TIMEOUT': {
    category: 'TECHNICAL',
    standardCode: 'GATEWAY_TIMEOUT',
    gatewayCode: 'GATEWAY_TIMEOUT',
    severity: 'MEDIUM',
    recoverability: 'HIGH',
    recommendedChannels: ['OPTIMAL_DELAYED_RETRY', 'IMMEDIATE_RETRY'],
    avoidChannels: ['WHATSAPP_NUDGE'],
    reasoning: 'Issuer bank or switch timed out under heavy load. A delayed retry after switch stabilization has 78% probability.',
    technicalDescription: 'Issuer bank or switch timed out after 30,000ms response window.',
    merchantDescription: 'Issuer bank server timed out during dual-factor authentication.',
    isTransient: true,
    requiresCustomerAction: false,
    isPermanentOrFraud: false,
    baseRecoveryProbability: 0.78,
  },
  'BANK_SERVER_DOWN': {
    category: 'TECHNICAL',
    standardCode: 'ISSUER_UNAVAILABLE',
    gatewayCode: 'BANK_SERVER_DOWN',
    severity: 'MEDIUM',
    recoverability: 'HIGH',
    recommendedChannels: ['OPTIMAL_DELAYED_RETRY', 'PAYMENT_LINK'],
    avoidChannels: ['IMMEDIATE_RETRY'],
    reasoning: 'Issuer Core Banking System (CBS) downtime. Immediate retries will fail 100%. Delay retry 2-4 hours or offer alternative bank link.',
    technicalDescription: 'Target bank core banking system (CBS) is undergoing maintenance.',
    merchantDescription: 'Issuer CBS maintenance window. Best recovered after 2-4 hours.',
    isTransient: true,
    requiresCustomerAction: false,
    isPermanentOrFraud: false,
    baseRecoveryProbability: 0.74,
  },
  'INSUFFICIENT_FUNDS': {
    category: 'INSUFFICIENT_FUNDS',
    standardCode: 'LOW_BALANCE',
    gatewayCode: 'INSUFFICIENT_FUNDS',
    severity: 'MEDIUM',
    recoverability: 'HIGH',
    recommendedChannels: ['OPTIMAL_DELAYED_RETRY', 'PAYMENT_LINK', 'WHATSAPP_NUDGE'],
    avoidChannels: ['IMMEDIATE_RETRY'],
    reasoning: 'Customer account balance is below ticket amount. Immediate retries cause spam fatigue. Optimal recovery is scheduled delayed retry or gentle nudge.',
    technicalDescription: 'Account balance lower than transaction ticket size at debit attempt.',
    merchantDescription: 'Customer balance low. Optimal recovery window is morning of 1st-5th of month (salary credit).',
    isTransient: true,
    requiresCustomerAction: false,
    isPermanentOrFraud: false,
    baseRecoveryProbability: 0.65,
  },
  'AUTHENTICATION_FAILED_3DS': {
    category: 'AUTHENTICATION',
    standardCode: 'OTP_AUTH_TIMEOUT',
    gatewayCode: 'AUTHENTICATION_FAILED_3DS',
    severity: 'HIGH',
    recoverability: 'HIGH',
    recommendedChannels: ['WHATSAPP_NUDGE', 'PAYMENT_LINK'],
    avoidChannels: ['IMMEDIATE_RETRY', 'OPTIMAL_DELAYED_RETRY'],
    reasoning: 'Customer did not enter OTP or session expired. Silent backend retries are useless because 3DS mandates interactive customer entry. Dispatch 1-tap checkout link.',
    technicalDescription: 'Customer failed to submit OTP within 180s or closed ACS window.',
    merchantDescription: '3D Secure OTP authentication dropped by customer.',
    isTransient: false,
    requiresCustomerAction: true,
    isPermanentOrFraud: false,
    baseRecoveryProbability: 0.72,
  },
  'CUSTOMER_DROPPED_OFF': {
    category: 'CUSTOMER_DROPOUT',
    standardCode: 'DROPOUT_PAYMENT_APP',
    gatewayCode: 'CUSTOMER_DROPPED_OFF',
    severity: 'LOW',
    recoverability: 'HIGH',
    recommendedChannels: ['WHATSAPP_NUDGE', 'PAYMENT_LINK'],
    avoidChannels: ['IMMEDIATE_RETRY'],
    reasoning: 'High intent customer opened payment app but abandoned. Instant interactive nudge recovers over 80% without intrusive calling.',
    technicalDescription: 'App switch intent triggered but completion callback not received.',
    merchantDescription: 'Customer navigated away before confirming UPI authorization pin.',
    isTransient: false,
    requiresCustomerAction: true,
    isPermanentOrFraud: false,
    baseRecoveryProbability: 0.80,
  },
  'CARD_EXPIRED': {
    category: 'EXPIRED_OR_INVALID',
    standardCode: 'CARD_EXPIRY_REACHED',
    gatewayCode: 'CARD_EXPIRED',
    severity: 'HIGH',
    recoverability: 'MEDIUM',
    recommendedChannels: ['PAYMENT_LINK', 'MANDATE_UPDATE'],
    avoidChannels: ['IMMEDIATE_RETRY', 'OPTIMAL_DELAYED_RETRY'],
    reasoning: 'Card validity expired. Retrying the existing card token will permanently fail. Request customer to enter new card or switch to UPI.',
    technicalDescription: 'Expiry MM/YY is in the past according to payment network calendar.',
    merchantDescription: 'Saved card reached expiration date.',
    isTransient: false,
    requiresCustomerAction: true,
    isPermanentOrFraud: false,
    baseRecoveryProbability: 0.58,
  },
  'MANDATE_INACTIVE': {
    category: 'MANDATE_ISSUE',
    standardCode: 'SI_MANDATE_LAPSED',
    gatewayCode: 'MANDATE_INACTIVE',
    severity: 'HIGH',
    recoverability: 'MEDIUM',
    recommendedChannels: ['MANDATE_UPDATE', 'PAYMENT_LINK'],
    avoidChannels: ['IMMEDIATE_RETRY', 'OPTIMAL_DELAYED_RETRY'],
    reasoning: 'Standing instruction mandate revoked or max limit breached. Requires customer mandate re-authorization.',
    technicalDescription: 'Recurring mandate status returned REVOKED or LIMIT_EXCEEDED.',
    merchantDescription: 'Autopay mandate expired or daily bank velocity limit reached.',
    isTransient: false,
    requiresCustomerAction: true,
    isPermanentOrFraud: false,
    baseRecoveryProbability: 0.62,
  },
  'VPA_NOT_FOUND': {
    category: 'EXPIRED_OR_INVALID',
    standardCode: 'UPI_ID_DEREGISTERED',
    gatewayCode: 'VPA_NOT_FOUND',
    severity: 'HIGH',
    recoverability: 'LOW',
    recommendedChannels: ['PAYMENT_LINK', 'WHATSAPP_NUDGE'],
    avoidChannels: ['IMMEDIATE_RETRY', 'OPTIMAL_DELAYED_RETRY'],
    reasoning: 'UPI VPA handle deregistered or unlinked. Automated retry will fail. Send multi-rail payment link.',
    technicalDescription: 'NPCI UPI Directory returned VPA_INVALID or handle deregistered.',
    merchantDescription: 'UPI ID is no longer valid or bank account unlinked from UPI app.',
    isTransient: false,
    requiresCustomerAction: true,
    isPermanentOrFraud: false,
    baseRecoveryProbability: 0.45,
  },
  'HIGH_RISK_SUSPECTED': {
    category: 'RISK_AND_FRAUD',
    standardCode: 'FRAUD_ENGINE_FLAG',
    gatewayCode: 'HIGH_RISK_SUSPECTED',
    severity: 'CRITICAL',
    recoverability: 'ZERO',
    recommendedChannels: ['DO_NOT_RECOVER'],
    avoidChannels: ['IMMEDIATE_RETRY', 'OPTIMAL_DELAYED_RETRY', 'WHATSAPP_NUDGE', 'PAYMENT_LINK'],
    reasoning: 'Flagged by card scheme fraud switch (VISA/Mastercard Risk Manager). Hard suppression required to prevent chargeback penalties.',
    technicalDescription: 'High risk velocity, IP geolocation mismatch, or card reported stolen.',
    merchantDescription: 'Flagged by issuer risk model. DO NOT RECOVER to prevent chargebacks.',
    isTransient: false,
    requiresCustomerAction: false,
    isPermanentOrFraud: true,
    baseRecoveryProbability: 0.04,
  },
  'CARD_REPORTED_LOST_STOLEN': {
    category: 'RISK_AND_FRAUD',
    standardCode: 'HOTLISTED_CARD',
    gatewayCode: 'CARD_REPORTED_LOST_STOLEN',
    severity: 'CRITICAL',
    recoverability: 'ZERO',
    recommendedChannels: ['DO_NOT_RECOVER'],
    avoidChannels: ['IMMEDIATE_RETRY', 'OPTIMAL_DELAYED_RETRY', 'WHATSAPP_NUDGE', 'PAYMENT_LINK', 'HUMAN_ESCALATION'],
    reasoning: 'Card hotlisted as stolen by issuer. Zero recoverability. Any retry attempt incurs heavy merchant scheme fines.',
    technicalDescription: 'Card status is marked STOLEN / BLOCKED by card network.',
    merchantDescription: 'Card hotlisted by issuing bank. Absolute DO NOT RECOVER.',
    isTransient: false,
    requiresCustomerAction: false,
    isPermanentOrFraud: true,
    baseRecoveryProbability: 0.01,
  },
};

export function diagnosePaymentFailure(
  failureCode: string,
  paymentMethod: PaymentMethod = 'UPI',
  rawError?: string
): FailureDiagnosis {
  const match = FAILURE_CATALOG[failureCode];
  if (match) {
    return match;
  }

  // Fallback heuristic classification
  const normalized = (failureCode + ' ' + (rawError || '')).toUpperCase();
  
  if (normalized.includes('TIMEOUT') || normalized.includes('GATEWAY') || normalized.includes('504')) {
    return FAILURE_CATALOG['GATEWAY_TIMEOUT'];
  }
  if (normalized.includes('BALANCE') || normalized.includes('FUNDS') || normalized.includes('LIMIT')) {
    return FAILURE_CATALOG['INSUFFICIENT_FUNDS'];
  }
  if (normalized.includes('OTP') || normalized.includes('3DS') || normalized.includes('AUTH')) {
    return FAILURE_CATALOG['AUTHENTICATION_FAILED_3DS'];
  }
  if (normalized.includes('FRAUD') || normalized.includes('RISK') || normalized.includes('STOLEN')) {
    return FAILURE_CATALOG['HIGH_RISK_SUSPECTED'];
  }
  if (normalized.includes('MANDATE') || normalized.includes('ENACH') || normalized.includes('SI_')) {
    return FAILURE_CATALOG['MANDATE_INACTIVE'];
  }
  if (normalized.includes('EXPIRED')) {
    return FAILURE_CATALOG['CARD_EXPIRED'];
  }
  if (normalized.includes('DROP') || normalized.includes('CANCEL') || normalized.includes('ABANDON')) {
    return FAILURE_CATALOG['CUSTOMER_DROPPED_OFF'];
  }

  // Default unknown technical glitch
  return {
    category: 'TECHNICAL',
    standardCode: 'UNKNOWN_GATEWAY_ANOMALY',
    gatewayCode: failureCode || 'UNKNOWN_ERROR',
    severity: 'MEDIUM',
    recoverability: 'MEDIUM',
    recommendedChannels: ['OPTIMAL_DELAYED_RETRY'],
    avoidChannels: ['IMMEDIATE_RETRY'],
    reasoning: 'Undetermined banking gateway anomaly. Recommending cautious delayed retry.',
    technicalDescription: rawError || 'Undetermined gateway failure response.',
    merchantDescription: 'Unspecified banking switch anomaly.',
    isTransient: true,
    requiresCustomerAction: false,
    isPermanentOrFraud: false,
    baseRecoveryProbability: 0.50,
  };
}

// Backwards-compatible helper
export function classifyPaymentFailure(
  failureCode: string,
  paymentMethod: PaymentMethod = 'UPI',
  rawError?: string
): FailureDiagnosis {
  return diagnosePaymentFailure(failureCode, paymentMethod, rawError);
}
