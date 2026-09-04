/**
 * Phase 8.8 — Reconciliation Types & Status Enums
 *
 * Defines explicit reconciliation outcomes, webhook reconciliation records,
 * and payment reconciliation contracts.
 *
 * CRITICAL INVARIANT:
 * Never collapse UNKNOWN into FAILURE. Doing so can cause duplicate payment attempts.
 */

export type ReconciliationOutcome =
  | 'CONFIRMED_SUCCESS'
  | 'CONFIRMED_FAILURE'
  | 'NOT_FOUND'
  | 'PENDING_PROVIDER'
  | 'UNKNOWN'
  | 'CONFLICT'
  | 'MANUAL_REVIEW_REQUIRED';

export type WebhookReconciliationStatus =
  | 'MATCHED'
  | 'PENDING'
  | 'MISSING'
  | 'CONFLICT'
  | 'RESOLVED'
  | 'MANUAL_REVIEW';

export interface PaymentReconciliationResult {
  transactionId: string;
  merchantId: string;
  providerReference?: string;
  providerStatus?: string;
  localStatus: string;
  outcome: ReconciliationOutcome;
  safeToRetry: boolean;
  requiresManualReview: boolean;
  reconciliationNotes: string;
  reconciledAt: string;
}

export interface WebhookReconciliationResult {
  id: string;
  merchantId: string;
  providerReference: string;
  expectedEvent: string;
  observedEvent?: string;
  status: WebhookReconciliationStatus;
  attemptCount: number;
  resolutionNotes?: string;
  reconciledAt: string;
}
