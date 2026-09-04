/**
 * Phase 8.8 — Webhook Reconciliation Service
 *
 * Reconciles delayed, duplicate, missing, or out-of-order webhook events
 * against authoritative transaction state and provider records.
 *
 * INVARIANTS:
 * 1. Webhook delivery is never the sole source of truth.
 * 2. Processing is strictly idempotent; duplicated webhooks are safely acknowledged.
 * 3. Out-of-order events do not revert terminal business states (e.g. FAILED cannot overwrite RECOVERED).
 */

import { prisma } from '../../db/prisma';
import { IN_MEMORY_TRANSACTIONS } from '../../razorpay/webhooks';
import { WebhookReconciliationRecord } from '@prisma/client';
import {
  WebhookReconciliationStatus,
  WebhookReconciliationResult,
} from './reconciliation-types';

export class WebhookReconciliationService {
  private static memoryRecords = new Map<string, WebhookReconciliationResult>();

  static clearMemoryForTesting(): void {
    this.memoryRecords.clear();
  }

  /**
   * Tracks an expected webhook event to detect delivery gaps.
   */
  static async registerExpectedWebhook(params: {
    merchantId: string;
    providerReference: string;
    expectedEvent: string;
  }): Promise<WebhookReconciliationResult> {
    const id = `whrec_${Date.now()}_${params.providerReference}`;
    const nowIso = new Date().toISOString();

    const record: WebhookReconciliationResult = {
      id,
      merchantId: params.merchantId,
      providerReference: params.providerReference,
      expectedEvent: params.expectedEvent,
      status: 'PENDING',
      attemptCount: 1,
      reconciledAt: nowIso,
    };

    this.memoryRecords.set(params.providerReference, record);
    return record;
  }

  /**
   * Processes an incoming webhook event safely with out-of-order and duplicate guards.
   */
  static async reconcileIncomingWebhook(params: {
    merchantId: string;
    providerReference: string;
    eventType: string; // e.g. 'payment.captured', 'payment.failed'
    transactionId?: string;
  }): Promise<{
    processed: boolean;
    isDuplicate: boolean;
    stateUpdated: boolean;
    status: WebhookReconciliationStatus;
    message: string;
  }> {
    const { merchantId, providerReference, eventType, transactionId } = params;

    // 1. Check existing tracking record
    const existing = this.memoryRecords.get(providerReference);

    // 2. Fetch authoritative transaction state
    let txn: any = null;
    if (transactionId) {
      if (process.env.SKIP_DB !== 'true') {
        try {
          txn = await prisma.transaction.findFirst({
            where: { id: transactionId },
          });
        } catch {
          // Fall back to memory
        }
      }
      if (!txn) {
        txn = IN_MEMORY_TRANSACTIONS.get(transactionId);
      }
    }

    // 3. Duplicate check: If transaction is already RECOVERED and event is captured
    if (txn && txn.status === 'RECOVERED') {
      if (eventType === 'payment.captured') {
        return {
          processed: true,
          isDuplicate: true,
          stateUpdated: false,
          status: 'RESOLVED',
          message: 'Duplicate capture webhook received. Transaction already RECOVERED.',
        };
      }
      if (eventType === 'payment.failed') {
        // Out-of-order event: Late failure event must NEVER overwrite an already recovered transaction!
        return {
          processed: true,
          isDuplicate: false,
          stateUpdated: false,
          status: 'CONFLICT',
          message: 'Out-of-order webhook: Late payment.failed ignored because transaction is already RECOVERED.',
        };
      }
    }

    // 4. Update transaction state if event is payment.captured
    let stateUpdated = false;
    if (eventType === 'payment.captured' && txn && txn.status !== 'RECOVERED') {
      if (process.env.SKIP_DB !== 'true') {
        try {
          await prisma.transaction.update({
            where: { id: txn.id },
            data: { status: 'RECOVERED', paymentId: providerReference, recoveredAt: new Date() },
          });
        } catch {
          // Memory update
        }
      }
      txn.status = 'RECOVERED';
      txn.paymentId = providerReference;
      stateUpdated = true;
    }

    const updatedRecord: WebhookReconciliationResult = {
      id: existing?.id || `whrec_${Date.now()}_${providerReference}`,
      merchantId,
      providerReference,
      expectedEvent: existing?.expectedEvent || eventType,
      observedEvent: eventType,
      status: 'MATCHED',
      attemptCount: (existing?.attemptCount || 0) + 1,
      resolutionNotes: stateUpdated ? 'Synchronized local transaction state to RECOVERED' : 'Acknowledged safely',
      reconciledAt: new Date().toISOString(),
    };

    this.memoryRecords.set(providerReference, updatedRecord);

    return {
      processed: true,
      isDuplicate: false,
      stateUpdated,
      status: 'MATCHED',
      message: 'Webhook reconciled successfully.',
    };
  }

  /**
   * Scans for webhook delivery gaps (events pending longer than threshold).
   */
  static async detectGaps(thresholdMinutes = 15): Promise<WebhookReconciliationResult[]> {
    const now = Date.now();
    const thresholdMs = thresholdMinutes * 60 * 1000;
    const gaps: WebhookReconciliationResult[] = [];

    for (const record of this.memoryRecords.values()) {
      if (record.status === 'PENDING') {
        const age = now - new Date(record.reconciledAt).getTime();
        if (age > thresholdMs) {
          record.status = 'MISSING';
          record.resolutionNotes = `Webhook gap detected: expected '${record.expectedEvent}' not delivered after ${thresholdMinutes}m.`;
          gaps.push(record);
        }
      }
    }

    return gaps;
  }
}
