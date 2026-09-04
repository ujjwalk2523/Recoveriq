/**
 * Phase 8.8 — Central Reconciliation Coordinator Service
 *
 * Exposes a unified facade for payment reconciliation, webhook gap detection,
 * and manual review queues.
 */

import { PaymentReconciliationService } from './payment-reconciliation';
import { WebhookReconciliationService } from './webhook-reconciliation';
import { RecoveryReconciliationService } from './recovery-reconciliation';
import {
  PaymentReconciliationResult,
  WebhookReconciliationResult,
} from './reconciliation-types';

export class ReconciliationService {
  private static manualReviewQueue: PaymentReconciliationResult[] = [];

  static clearMemoryForTesting(): void {
    PaymentReconciliationService.clearMockProviderStates();
    WebhookReconciliationService.clearMemoryForTesting();
    this.manualReviewQueue = [];
  }

  /**
   * Reconciles a transaction and queues for manual review if ambiguous.
   */
  static async reconcileTransaction(params: {
    transactionId: string;
    merchantId: string;
    providerReference?: string;
  }): Promise<PaymentReconciliationResult> {
    const result = await PaymentReconciliationService.reconcileTransaction(params);

    if (result.requiresManualReview || result.outcome === 'MANUAL_REVIEW_REQUIRED' || result.outcome === 'CONFLICT') {
      const idx = this.manualReviewQueue.findIndex(q => q.transactionId === result.transactionId);
      if (idx >= 0) {
        this.manualReviewQueue[idx] = result;
      } else {
        this.manualReviewQueue.push(result);
      }
    }

    return result;
  }

  /**
   * Returns all items currently held in the manual review queue.
   */
  static getManualReviewQueue(): PaymentReconciliationResult[] {
    return [...this.manualReviewQueue];
  }

  /**
   * Manually resolves an uncertain item from the queue with an explicit operational rationale.
   */
  static resolveManualReview(
    transactionId: string,
    resolution: 'MARK_RECOVERED' | 'SAFE_TO_RETRY' | 'ABANDON',
    resolvedBy: string,
    notes: string
  ): PaymentReconciliationResult | null {
    const idx = this.manualReviewQueue.findIndex(q => q.transactionId === transactionId);
    if (idx === -1) return null;

    const item = this.manualReviewQueue[idx];
    item.requiresManualReview = false;
    item.reconciliationNotes = `Manually resolved by ${resolvedBy}: ${resolution}. Rationale: ${notes}`;

    if (resolution === 'MARK_RECOVERED') {
      item.outcome = 'CONFIRMED_SUCCESS';
      item.safeToRetry = false;
    } else if (resolution === 'SAFE_TO_RETRY') {
      item.outcome = 'CONFIRMED_FAILURE';
      item.safeToRetry = true;
    } else {
      item.outcome = 'CONFIRMED_FAILURE';
      item.safeToRetry = false;
    }

    this.manualReviewQueue.splice(idx, 1);
    return item;
  }

  /**
   * Scans for webhook delivery gaps.
   */
  static async detectWebhookGaps(thresholdMinutes = 15): Promise<WebhookReconciliationResult[]> {
    return WebhookReconciliationService.detectGaps(thresholdMinutes);
  }
}
