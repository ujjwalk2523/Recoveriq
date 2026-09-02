import { FailureCategory, PaymentMethod } from './types';

export interface ClassifiedFailure {
  category: FailureCategory;
  standardCode: string;
  gatewayCode: string;
  technicalDescription: string;
  merchantDescription: string;
  isTransient: boolean; // can retry immediately or shortly
  requiresCustomerAction: boolean; // requires link / whatsapp
  isPermanentOrFraud: boolean; // should DO NOT RECOVER
  baseRecoveryProbability: number;
}

export const FAILURE_CATALOG: Record<string, ClassifiedFailure> = {
  'BAD_REQUEST_ERROR': {
    category: 'TECHNICAL',
    standardCode: 'GATEWAY_BAD_REQUEST',
    gatewayCode: 'BAD_REQUEST_ERROR',
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
    technicalDescription: 'Account balance lower than transaction ticket size at debit attempt.',
    merchantDescription: 'Customer balance low. Optimal recovery window is morning of 1st-5th of month (salary credit).',
    isTransient: true,
    requiresCustomerAction: false,
    isPermanentOrFraud: false,
    baseRecoveryProbability: 0.65,
  },
  'AUTHENTICATION_FAILED_3DS': {
    category: 'AUTHENTICATION',
    standardCode: 'OTP_EXPIRED_OR_INCORRECT',
    gatewayCode: 'AUTHENTICATION_FAILED_3DS',
    technicalDescription: '3D Secure 2.0 OTP expired, wrong OTP entered, or biometric check missed.',
    merchantDescription: 'Customer failed or missed OTP entry. Instant 1-tap WhatsApp payment link has 88% recovery.',
    isTransient: false,
    requiresCustomerAction: true,
    isPermanentOrFraud: false,
    baseRecoveryProbability: 0.84,
  },
  'CUSTOMER_DROPPED_OUT': {
    category: 'CUSTOMER_DROPOUT',
    standardCode: 'CHECKOUT_ABANDONED',
    gatewayCode: 'CUSTOMER_DROPPED_OUT',
    technicalDescription: 'User closed payment sheet or switched apps without completing intent.',
    merchantDescription: 'Customer navigated away before UPI intent or card verification finished.',
    isTransient: false,
    requiresCustomerAction: true,
    isPermanentOrFraud: false,
    baseRecoveryProbability: 0.79,
  },
  'DAILY_LIMIT_EXCEEDED': {
    category: 'INSUFFICIENT_FUNDS',
    standardCode: 'UPI_LIMIT_BREACHED',
    gatewayCode: 'DAILY_LIMIT_EXCEEDED',
    technicalDescription: 'UPI per-transaction or cumulative 24h ₹1,00,000 NPCI limit reached.',
    merchantDescription: 'UPI daily ceiling exceeded. Auto-switching to NetBanking / Credit Card link recovers 85%.',
    isTransient: false,
    requiresCustomerAction: true,
    isPermanentOrFraud: false,
    baseRecoveryProbability: 0.76,
  },
  'MANDATE_INACTIVE': {
    category: 'MANDATE_ISSUE',
    standardCode: 'AUTODEBIT_MANDATE_PAUSED',
    gatewayCode: 'MANDATE_INACTIVE',
    technicalDescription: 'eNACH / UPI recurring auto-debit mandate cancelled, expired or suspended.',
    merchantDescription: 'Recurring auto-debit mandate expired or revoked by customer via banking app.',
    isTransient: false,
    requiresCustomerAction: true,
    isPermanentOrFraud: false,
    baseRecoveryProbability: 0.58,
  },
  'CARD_EXPIRED': {
    category: 'EXPIRED_OR_INVALID',
    standardCode: 'CARD_EXPIRED_OR_REPLACED',
    gatewayCode: 'CARD_EXPIRED',
    technicalDescription: 'Card token expiration date has passed or token destroyed by issuer.',
    merchantDescription: 'Stored card token expired. Do not retry directly; send zero-friction update link.',
    isTransient: false,
    requiresCustomerAction: true,
    isPermanentOrFraud: false,
    baseRecoveryProbability: 0.62,
  },
  'VPA_NOT_FOUND': {
    category: 'EXPIRED_OR_INVALID',
    standardCode: 'UPI_ID_DEREGISTERED',
    gatewayCode: 'VPA_NOT_FOUND',
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
    technicalDescription: 'Card status is marked STOLEN / BLOCKED by card network.',
    merchantDescription: 'Card hotlisted by issuing bank. Absolute DO NOT RECOVER.',
    isTransient: false,
    requiresCustomerAction: false,
    isPermanentOrFraud: true,
    baseRecoveryProbability: 0.01,
  },
};

export function classifyPaymentFailure(
  failureCode: string,
  paymentMethod: PaymentMethod,
  rawError?: string
): ClassifiedFailure {
  const match = FAILURE_CATALOG[failureCode];
  if (match) {
    return match;
  }

  // Fallback heuristic based on code string
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

  // Default unknown technical glitch
  return {
    category: 'TECHNICAL',
    standardCode: 'UNKNOWN_GATEWAY_ANOMALY',
    gatewayCode: failureCode || 'UNKNOWN_ERROR',
    technicalDescription: rawError || 'Undetermined gateway failure response.',
    merchantDescription: 'Unspecified banking switch anomaly.',
    isTransient: true,
    requiresCustomerAction: false,
    isPermanentOrFraud: false,
    baseRecoveryProbability: 0.50,
  };
}
