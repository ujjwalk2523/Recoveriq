import { prisma } from '@/lib/db/prisma';
import { RecoveryActionType, AttemptStatus, PaymentStatus } from '@prisma/client';
import { RazorpayWebhookPayload, RazorpayMapper, NormalizedPaymentEvent } from './mapper';
import { CustomerProfile, PolicyGuardrails } from '@/lib/engine/types';
import { RecoveryIntelligenceEngine } from '@/lib/engine/recovery-intelligence';
import { RecoveryOrchestrator } from '@/lib/engine/sequence-orchestrator';
import { AuditService } from '@/lib/services/audit.service';
import { defaultBanditService } from '@/lib/ml/bandit/bandit-service';
import { BanditOutcomeAttributionService, ACTION_BASE_COSTS } from '@/lib/ml/bandit/bandit-outcome-attribution';
import { RecoverIQEventStore, RecoverIQEventType } from '@/lib/webhooks';

export interface WebhookProcessingResult {
  success: boolean;
  status: 'PROCESSED' | 'DUPLICATE_IGNORED' | 'ERROR';
  eventId: string;
  eventType: string;
  transactionId?: string;
  message?: string;
  inMemoryFallback?: boolean;
}

// In-memory fallback caches for development / offline resilience
export const IN_MEMORY_PROCESSED_EVENTS = new Set<string>();
export const IN_MEMORY_TRANSACTIONS = new Map<string, any>();

export class RazorpayWebhookService {
  /**
   * Main entry point to process validated Razorpay webhooks
   */
  static async processWebhook(
    payload: RazorpayWebhookPayload,
    targetMerchantId?: string
  ): Promise<WebhookProcessingResult> {
    const merchantId = targetMerchantId || 'mer_saasify_blr';
    const eventId = RazorpayMapper.extractEventId(payload);
    const eventType = payload.event || 'payment.failed';

    let isDbAvailable = true;

    try {
      // 1. Idempotency Check in DB
      let existingEvent: any = null;
      try {
        existingEvent = await prisma.webhookEvent.findUnique({
          where: { eventId },
        });
      } catch (dbErr) {
        isDbAvailable = false;
      }

      if (existingEvent && existingEvent.processed) {
        console.log(`[Idempotency Guard] Skipping duplicate event ${eventId} (${eventType})`);
        return {
          success: true,
          status: 'DUPLICATE_IGNORED',
          eventId,
          eventType,
          message: 'Webhook event was already processed previously (idempotency enforced).',
        };
      }

      // If DB is offline, check in-memory cache
      if (!isDbAvailable && IN_MEMORY_PROCESSED_EVENTS.has(eventId)) {
        console.log(`[Idempotency Guard] (Memory) Skipping duplicate event ${eventId} (${eventType})`);
        return {
          success: true,
          status: 'DUPLICATE_IGNORED',
          eventId,
          eventType,
          message: 'Webhook event was already processed previously (idempotency enforced).',
          inMemoryFallback: true,
        };
      }

      // 2. Persist WebhookEvent log if DB available
      let webhookRecordId: string | null = null;
      if (isDbAvailable) {
        try {
          const webhookRecord = await prisma.webhookEvent.upsert({
            where: { eventId },
            update: { payload: payload as any },
            create: {
              eventId,
              merchantId,
              source: 'RAZORPAY',
              eventType,
              payload: payload as any,
              processed: false,
            },
          });
          webhookRecordId = webhookRecord.id;
        } catch {
          isDbAvailable = false;
        }
      }

      // 3. Transform to Domain Event
      const domainEvent = RazorpayMapper.toDomainEvent(payload);

      let transactionId: string | undefined;

      // 4. Handle Event by Type
      if (eventType === 'payment.failed') {
        transactionId = isDbAvailable
          ? await this.handlePaymentFailed(merchantId, domainEvent)
          : await this.handlePaymentFailedInMemory(merchantId, domainEvent);
      } else if (eventType === 'payment.captured' || eventType === 'order.paid') {
        transactionId = isDbAvailable
          ? await this.handlePaymentCaptured(merchantId, domainEvent)
          : await this.handlePaymentCapturedInMemory(merchantId, domainEvent);
      } else {
        console.log(`[Razorpay Webhook] Received unhandled event: ${eventType}`);
      }

      // 5. Mark WebhookEvent as processed
      if (isDbAvailable && webhookRecordId) {
        try {
          await prisma.webhookEvent.update({
            where: { id: webhookRecordId },
            data: {
              processed: true,
              processedAt: new Date(),
            },
          });
        } catch {
          // ignore
        }
      } else {
        IN_MEMORY_PROCESSED_EVENTS.add(eventId);
      }

      return {
        success: true,
        status: 'PROCESSED',
        eventId,
        eventType,
        transactionId,
        inMemoryFallback: !isDbAvailable,
      };
    } catch (err: any) {
      console.error(`[Razorpay Webhook Processing Failed] Event: ${eventId}`, err);

      return {
        success: false,
        status: 'ERROR',
        eventId,
        eventType,
        message: err?.message || 'Internal processing error',
      };
    }
  }

  /**
   * Database implementation of payment.failed using 8-stage Recovery Intelligence Engine
   */
  private static async handlePaymentFailed(
    merchantId: string,
    event: NormalizedPaymentEvent
  ): Promise<string> {
    // 1. Customer resolution
    let customer = await prisma.customer.findFirst({
      where: {
        merchantId,
        OR: [{ email: event.customer.email }, { phone: event.customer.phone }],
      },
      include: { recoveryProfile: true },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          merchantId,
          name: event.customer.name,
          email: event.customer.email,
          phone: event.customer.phone,
          segment: event.amountINR > 30000 ? 'VIP' : event.amountINR > 10000 ? 'ENTERPRISE' : 'CONSUMER',
          lifetimeValue: event.amountINR * 3,
          totalTransactions: 1,
          recoveryProfile: {
            create: {
              pastRecoveries: 0,
              fatigueScore: 15,
              riskScore: event.failureCategory === 'RISK_AND_FRAUD' ? 65 : 10,
              upiVpa: event.customer.upiVpa,
              bankName: event.customer.bankName,
              preferredChannel: event.method === 'UPI' ? 'WHATSAPP' : 'PAYMENT_LINK',
            },
          },
        },
        include: { recoveryProfile: true },
      });
    }

    const customerProfile: CustomerProfile = {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      segment: (customer.segment as any) || 'CONSUMER',
      lifetimeValue: customer.lifetimeValue,
      totalTransactions: customer.totalTransactions,
      pastRecoveries: customer.recoveryProfile?.pastRecoveries ?? 0,
      fatigueScore: customer.recoveryProfile?.fatigueScore ?? 10,
      riskScore: customer.recoveryProfile?.riskScore ?? 10,
      upiVpa: customer.recoveryProfile?.upiVpa ?? undefined,
      bankName: customer.recoveryProfile?.bankName ?? undefined,
    };

    // 2. Fetch active policy guardrails
    const policyRecord = await prisma.policyGuardrails.findUnique({
      where: { merchantId },
    });

    const activePolicies: PolicyGuardrails | undefined = policyRecord
      ? {
          id: policyRecord.id,
          autoApproveMaxAmount: policyRecord.autoApproveMaxAmount,
          minConfidenceForAutoApprove: policyRecord.minConfidenceForAutoApprove,
          maxCustomerFatigueThreshold: policyRecord.maxCustomerFatigueThreshold,
          maxRetriesPerCustomerPerWeek: policyRecord.maxRetriesPerCustomerPerWeek,
          disputeRiskBlockThreshold: policyRecord.disputeRiskBlockThreshold,
          allowAutomatedWhatsAppNudges: policyRecord.allowAutomatedWhatsApp,
          allowAutomatedPaymentLinks: policyRecord.allowAutomatedPaymentLinks,
          humanApprovalForVIPs: policyRecord.humanApprovalForVIPs,
          nightHoursRetrySilence: policyRecord.nightHoursRetrySilence,
        }
      : undefined;

    // 3. Execute 8-Stage Recovery Intelligence Pipeline
    const intelligence = RecoveryIntelligenceEngine.process({
      amount: event.amountINR,
      paymentMethod: event.method,
      failureCode: event.failureCode,
      failureMessage: event.failureMessage,
      customer: customerProfile,
      policies: activePolicies,
      attemptNumber: 1,
    });

    const initialStatus = intelligence.isAutoApproved ? PaymentStatus.RECOVERING : PaymentStatus.NEEDS_APPROVAL;
    const recommendedAction = intelligence.recommendedAction;

    // 4. Upsert Transaction
    const transaction = await prisma.transaction.create({
      data: {
        merchantId,
        customerId: customer.id,
        orderId: event.orderId,
        paymentId: event.paymentId,
        amount: event.amountINR,
        currency: event.currency,
        paymentMethod: event.method,
        status: initialStatus,
        failureCode: event.failureCode,
        failureMessage: event.failureMessage,
        failureCategory: event.failureCategory,
        rawGatewayResponse: event.rawPayload,
        recoveryProbability: intelligence.recoveryProbability,
        expectedRecoveryValue: intelligence.expectedNetRecoveryINR,
        recommendedAction,
        actionConfidence: intelligence.confidenceScore,
        aiRationale: intelligence.aiRationale,
        whyNotRationale: intelligence.whyNotRationale,
        requiresApproval: !intelligence.isAutoApproved,
        approvalReason: intelligence.approvalReason,
        executionChannel: recommendedAction,
        executionStatus: intelligence.isAutoApproved ? 'DISPATCHED' : 'PENDING',
      },
    });

    // Record Usage Metering for TRANSACTIONS_PROCESSED (Phase 7.2)
    try {
      const { UsageService } = await import('@/lib/billing/usage-service');
      const { UsageMetric } = await import('@/lib/billing/billing-types');
      await UsageService.recordUsage({
        merchantId,
        metric: UsageMetric.TRANSACTIONS_PROCESSED,
        quantity: 1,
        source: 'TRANSACTION_INGEST',
        sourceId: transaction.id,
        occurredAt: event.createdAt || new Date(),
      });
    } catch {
      // Non-blocking
    }

    // 5. PaymentEvent logging
    await prisma.paymentEvent.create({
      data: {
        transactionId: transaction.id,
        eventType: 'PAYMENT_FAILED',
        amount: event.amountINR,
        status: 'FAILED',
        gatewayErrorCode: event.failureCode,
        gatewayErrorMessage: event.failureMessage,
        rawPayload: event.rawPayload,
      },
    });

    // Emit RecoverIQ Domain Event (Phase 7.4)
    RecoverIQEventStore.emitEvent({
      merchantId,
      type: RecoverIQEventType.PAYMENT_FAILED,
      aggregateType: 'payment',
      aggregateId: transaction.id,
      payload: {
        transactionId: transaction.id,
        orderId: event.orderId,
        paymentId: event.paymentId,
        amount: event.amountINR,
        failureCode: event.failureCode,
        failureMessage: event.failureMessage,
        failureCategory: event.failureCategory,
      },
    }).catch(() => {});

    // 6. Create Decision & 8-Step DecisionTraces
    const decision = await prisma.decision.create({
      data: {
        transactionId: transaction.id,
        recommendedAction,
        confidenceScore: intelligence.confidenceScore,
        recoveryProbability: intelligence.recoveryProbability,
        expectedRecoveryValue: intelligence.expectedNetRecoveryINR,
        rationale: intelligence.aiRationale,
        status: intelligence.isAutoApproved ? 'APPROVED' : 'PENDING',
      },
    });

    await prisma.decisionTrace.createMany({
      data: intelligence.decisionTraces.map(trace => ({
        decisionId: decision.id,
        step: trace.step,
        name: trace.name,
        status: trace.status,
        summary: trace.summary,
        details: trace.details as any,
      })),
    });

    // 6.5 Evaluate Contextual Bandit Proposal (in Shadow Mode)
    let banditDecisionId: string | undefined;
    let banditAction: string | undefined;
    const banditModelVersion = 'bandit-v1.0';

    try {
      const dummyHealthReport: any = {
        healthScore: 100,
        grade: 'HEALTHY',
        calibration: { ece: 0.03, mce: 0.05, brierScore: 0.15, isWellCalibrated: true, evaluatedSamples: 1000, binCount: 10, generatedAt: new Date().toISOString() },
        drift: { featureDrifts: [], outcomeDrift: { baselineRecoveryRate: 0.7, currentRecoveryRate: 0.7, delta: 0, status: 'STABLE' }, overallStatus: 'STABLE', generatedAt: new Date().toISOString() },
        shouldFallbackToHeuristics: false,
        generatedAt: new Date().toISOString(),
      };

      const banditPlan = await defaultBanditService.decide({
        transactionId: transaction.id,
        merchantId,
        amount: event.amountINR,
        paymentMethod: event.method as any,
        failureCategory: event.failureCategory as any,
        failureCode: event.failureCode,
        customerProfile,
        configuredRolloutTier: 'FULL_100',
        healthReport: dummyHealthReport,
        shadowMode: true, // Shadow mode: records proposal, heuristic baseline executes
      });

      banditDecisionId = `bandit_dec_${transaction.id}`;
      banditAction = banditPlan.selectedStrategy;
    } catch {
      // Seamless fallback: zero payment disruption if bandit service is offline
    }

    // 7. If auto-approved, initialize RecoveryAttempt #1
    if (intelligence.isAutoApproved && recommendedAction !== 'DO_NOT_RECOVER') {
      let validBanditDecisionId: string | undefined = undefined;
      if (banditDecisionId) {
        try {
          const exists = await prisma.banditDecision.findUnique({
            where: { id: banditDecisionId },
            select: { id: true },
          });
          if (exists) {
            validBanditDecisionId = exists.id;
          }
        } catch {
          // If query fails or table unpopulated, proceed with undefined FK
        }
      }

      await prisma.recoveryAttempt.create({
        data: {
          transactionId: transaction.id,
          attemptNumber: 1,
          actionType: recommendedAction,
          channel: recommendedAction,
          status: AttemptStatus.DISPATCHED,
          banditDecisionId: validBanditDecisionId,
          banditAction,
          banditModelVersion,
          metadata: {
            trigger: 'AUTOMATED_WEBHOOK_INGESTION',
            intelligenceDetails: {
              probability: intelligence.recoveryProbability,
              netEV: intelligence.expectedNetRecoveryINR,
            },
          },
        },
      });
    }

    // 8. Initialize Recovery Sequence in Orchestrator
    try {
      await RecoveryOrchestrator.startSequence({
        transactionId: transaction.id,
        merchantId,
        failureCategory: event.failureCategory,
        customer: customerProfile,
        amount: event.amountINR,
        policyCheck: intelligence.policyCheck,
        isAutoApproved: intelligence.isAutoApproved,
      });
    } catch {
      // resilient
    }

    // 9. Audit Log
    await AuditService.logEvent({
      merchantId,
      actorType: 'WEBHOOK_INGEST',
      actorName: 'Recovery Intelligence Engine v3.1',
      action: 'INGEST_FAILURE',
      entityType: 'TRANSACTION',
      entityId: transaction.id,
      details: `Processed payment.failed (${event.failureCode}) for ₹${event.amountINR.toLocaleString('en-IN')}. Net EV: ₹${intelligence.expectedNetRecoveryINR.toLocaleString('en-IN')}. Policy status: ${intelligence.isAutoApproved ? 'Auto-approved' : 'Needs approval'}.`,
    });

    return transaction.id;
  }

  /**
   * In-memory resilient implementation of payment.failed using RecoveryIntelligenceEngine
   */
  private static async handlePaymentFailedInMemory(
    merchantId: string,
    event: NormalizedPaymentEvent
  ): Promise<string> {
    const customerProfile: CustomerProfile = {
      id: `cust_${Math.random().toString(36).substring(2, 8)}`,
      name: event.customer.name,
      email: event.customer.email,
      phone: event.customer.phone,
      segment: event.amountINR > 30000 ? 'VIP' : event.amountINR > 10000 ? 'ENTERPRISE' : 'CONSUMER',
      lifetimeValue: event.amountINR * 3,
      totalTransactions: 1,
      pastRecoveries: 0,
      fatigueScore: 15,
      riskScore: event.failureCategory === 'RISK_AND_FRAUD' ? 65 : 10,
      upiVpa: event.customer.upiVpa,
      bankName: event.customer.bankName,
    };

    const intelligence = RecoveryIntelligenceEngine.process({
      amount: event.amountINR,
      paymentMethod: event.method,
      failureCode: event.failureCode,
      failureMessage: event.failureMessage,
      customer: customerProfile,
      attemptNumber: 1,
    });

    const txnId = `txn_mem_${Date.now()}`;

    // Evaluate Contextual Bandit Proposal (in Shadow Mode)
    let banditDecisionId: string = `bandit_dec_${txnId}`;
    let banditAction: string = intelligence.recommendedAction;
    const banditModelVersion = 'bandit-v1.0';

    try {
      const dummyHealthReport: any = {
        healthScore: 100,
        grade: 'HEALTHY',
        calibration: { ece: 0.03, mce: 0.05, brierScore: 0.15, isWellCalibrated: true, evaluatedSamples: 1000, binCount: 10, generatedAt: new Date().toISOString() },
        drift: { featureDrifts: [], outcomeDrift: { baselineRecoveryRate: 0.7, currentRecoveryRate: 0.7, delta: 0, status: 'STABLE' }, overallStatus: 'STABLE', generatedAt: new Date().toISOString() },
        shouldFallbackToHeuristics: false,
        generatedAt: new Date().toISOString(),
      };

      const banditPlan = await defaultBanditService.decide({
        transactionId: txnId,
        merchantId,
        amount: event.amountINR,
        paymentMethod: event.method as any,
        failureCategory: event.failureCategory as any,
        failureCode: event.failureCode,
        customerProfile,
        configuredRolloutTier: 'FULL_100',
        healthReport: dummyHealthReport,
        shadowMode: true,
      });

      banditAction = banditPlan.selectedStrategy;
    } catch {
      // Seamless fallback
    }

    const memoryTxn = {
      id: txnId,
      merchantId,
      orderId: event.orderId,
      paymentId: event.paymentId,
      amount: event.amountINR,
      currency: event.currency,
      paymentMethod: event.method,
      status: intelligence.isAutoApproved ? 'RECOVERING' : 'NEEDS_APPROVAL',
      failureCategory: event.failureCategory,
      failureCode: event.failureCode,
      failureMessage: event.failureMessage,
      recoveryProbability: intelligence.recoveryProbability,
      expectedRecoveryValue: intelligence.expectedNetRecoveryINR,
      recommendedAction: intelligence.recommendedAction,
      banditDecisionId,
      banditAction,
      banditModelVersion,
      dataSource: 'RAZORPAY_TEST',
      customer: customerProfile,
      recoveryAttempts: [
        {
          id: `att_${txnId}_1`,
          attemptNumber: 1,
          actionType: intelligence.recommendedAction,
          cost: ACTION_BASE_COSTS[intelligence.recommendedAction] ?? 3.50,
          banditDecisionId,
          banditAction,
          banditModelVersion,
        },
      ],
      paymentEvents: [
        {
          id: `pe_${Date.now()}`,
          eventType: 'PAYMENT_FAILED',
          amount: event.amountINR,
          status: 'FAILED',
          createdAt: new Date(),
        },
      ],
      decisions: [
        {
          id: `dec_${Date.now()}`,
          recommendedAction: intelligence.recommendedAction,
          decisionTraces: intelligence.decisionTraces,
        },
      ],
      strategyYields: intelligence.strategyYields,
      recoveredAmount: null,
      recoveredAt: null,
    };

    IN_MEMORY_TRANSACTIONS.set(event.orderId, memoryTxn);
    IN_MEMORY_TRANSACTIONS.set(event.paymentId, memoryTxn);
    IN_MEMORY_TRANSACTIONS.set(txnId, memoryTxn);

    // Record Usage Metering for TRANSACTIONS_PROCESSED (Phase 7.2)
    try {
      const { UsageService } = await import('@/lib/billing/usage-service');
      const { UsageMetric } = await import('@/lib/billing/billing-types');
      await UsageService.recordUsage({
        merchantId,
        metric: UsageMetric.TRANSACTIONS_PROCESSED,
        quantity: 1,
        source: 'TRANSACTION_INGEST',
        sourceId: txnId,
        occurredAt: event.createdAt || new Date(),
      });
    } catch {
      // Non-blocking
    }

    try {
      await RecoveryOrchestrator.startSequence({
        transactionId: txnId,
        merchantId,
        failureCategory: event.failureCategory,
        customer: customerProfile,
        amount: event.amountINR,
        policyCheck: intelligence.policyCheck,
        isAutoApproved: intelligence.isAutoApproved,
      });
    } catch {
      // resilient
    }

    // Emit RecoverIQ Domain Event (Phase 7.4)
    RecoverIQEventStore.emitEvent({
      merchantId,
      type: RecoverIQEventType.PAYMENT_FAILED,
      aggregateType: 'payment',
      aggregateId: txnId,
      payload: {
        transactionId: txnId,
        orderId: event.orderId,
        paymentId: event.paymentId,
        amount: event.amountINR,
        failureCode: event.failureCode,
        failureMessage: event.failureMessage,
        failureCategory: event.failureCategory,
      },
    }).catch(() => {});

    return txnId;
  }

  /**
   * Database implementation of payment.captured
   */
  private static async handlePaymentCaptured(
    merchantId: string,
    event: NormalizedPaymentEvent
  ): Promise<string> {
    let transaction = await prisma.transaction.findFirst({
      where: {
        merchantId,
        OR: [
          { paymentId: event.paymentId },
          { orderId: event.orderId },
        ],
      },
      include: {
        recoveryAttempts: {
          orderBy: { attemptNumber: 'desc' },
          take: 1,
        },
      },
    });

    const now = new Date();

    if (transaction) {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: PaymentStatus.RECOVERED,
          recoveredAt: now,
          recoveredAmount: event.amountINR,
          executionStatus: 'SUCCEEDED',
        },
      });

      await prisma.paymentEvent.create({
        data: {
          transactionId: transaction.id,
          eventType: 'PAYMENT_CAPTURED',
          amount: event.amountINR,
          status: 'CAPTURED',
          rawPayload: event.rawPayload,
        },
      });

      if (transaction.recoveryAttempts.length > 0) {
        const latestAttempt = transaction.recoveryAttempts[0];
        await prisma.recoveryAttempt.update({
          where: { id: latestAttempt.id },
          data: {
            status: AttemptStatus.PAID,
            completedAt: now,
            recoveredAmount: event.amountINR,
            gatewayPaymentId: event.paymentId,
          },
        });
      }

      await AuditService.logEvent({
        merchantId,
        actorType: 'WEBHOOK_INGEST',
        actorName: 'Recovery Intelligence Engine v3.1',
        action: 'PAYMENT_RECOVERED',
        entityType: 'TRANSACTION',
        entityId: transaction.id,
        details: `₹${event.amountINR.toLocaleString('en-IN')} recovered successfully via ${event.method}.`,
      });

      // Emit RecoverIQ Domain Events (Phase 7.4)
      RecoverIQEventStore.emitEvent({
        merchantId,
        type: RecoverIQEventType.PAYMENT_CAPTURED,
        aggregateType: 'payment',
        aggregateId: transaction.id,
        payload: {
          transactionId: transaction.id,
          orderId: event.orderId,
          paymentId: event.paymentId,
          amount: event.amountINR,
          method: event.method,
        },
      }).catch(() => {});

      RecoverIQEventStore.emitEvent({
        merchantId,
        type: RecoverIQEventType.PAYMENT_RECOVERED,
        aggregateType: 'recovery',
        aggregateId: transaction.id,
        payload: {
          transactionId: transaction.id,
          recoveredAmount: event.amountINR,
          method: event.method,
          paymentId: event.paymentId,
        },
      }).catch(() => {});

      // Notify Recovery Orchestrator
      try {
        await RecoveryOrchestrator.handleStepOutcome({
          transactionId: transaction.id,
          stepNumber: transaction.recoveryAttempts[0]?.attemptNumber || 1,
          outcome: {
            eventType: 'PAYMENT_CAPTURED',
            amount: event.amountINR,
            gatewayPaymentId: event.paymentId,
            timestamp: now.toISOString(),
          },
          customerFatigueScore: 0,
        });
      } catch {
        // resilient
      }

      // 10. Closed-Loop Bandit Outcome Attribution
      try {
        await BanditOutcomeAttributionService.attributePaymentCaptured({
          merchantId,
          transactionId: transaction.id,
          orderId: event.orderId,
          paymentId: event.paymentId,
          amountINR: event.amountINR,
        });
      } catch (attrErr) {
        console.warn(`[RazorpayWebhookService] Outcome attribution error:`, attrErr);
      }

      return transaction.id;
    } else {
      console.log(`[Payment Captured] Transaction ${event.orderId} not found in failed ledger, skipping recovery transition.`);
      return 'not_tracked';
    }
  }

  /**
   * In-memory resilient implementation of payment.captured
   */
  private static async handlePaymentCapturedInMemory(
    merchantId: string,
    event: NormalizedPaymentEvent
  ): Promise<string> {
    const txn = IN_MEMORY_TRANSACTIONS.get(event.orderId) || IN_MEMORY_TRANSACTIONS.get(event.paymentId);
    if (txn) {
      txn.status = 'RECOVERED';
      txn.recoveredAt = new Date();
      txn.recoveredAmount = event.amountINR;
      txn.paymentEvents.push({
        id: `pe_${Date.now()}`,
        eventType: 'PAYMENT_CAPTURED',
        amount: event.amountINR,
        status: 'CAPTURED',
        createdAt: new Date(),
      });

      // Emit RecoverIQ Domain Events (Phase 7.4)
      RecoverIQEventStore.emitEvent({
        merchantId,
        type: RecoverIQEventType.PAYMENT_CAPTURED,
        aggregateType: 'payment',
        aggregateId: txn.id,
        payload: {
          transactionId: txn.id,
          orderId: event.orderId,
          paymentId: event.paymentId,
          amount: event.amountINR,
          method: event.method,
        },
      }).catch(() => {});

      RecoverIQEventStore.emitEvent({
        merchantId,
        type: RecoverIQEventType.PAYMENT_RECOVERED,
        aggregateType: 'recovery',
        aggregateId: txn.id,
        payload: {
          transactionId: txn.id,
          recoveredAmount: event.amountINR,
          method: event.method,
          paymentId: event.paymentId,
        },
      }).catch(() => {});

      try {
        await RecoveryOrchestrator.handleStepOutcome({
          transactionId: txn.id,
          stepNumber: 1,
          outcome: {
            eventType: 'PAYMENT_CAPTURED',
            amount: event.amountINR,
            gatewayPaymentId: event.paymentId,
            timestamp: new Date().toISOString(),
          },
          customerFatigueScore: 0,
        });
      } catch {
        // resilient
      }

      // Closed-loop bandit outcome attribution
      try {
        await BanditOutcomeAttributionService.attributePaymentCaptured({
          merchantId,
          transactionId: txn.id,
          orderId: event.orderId,
          paymentId: event.paymentId,
          amountINR: event.amountINR,
        });
      } catch {
        // resilient
      }

      return txn.id;
    }
    return 'not_tracked';
  }

  /**
   * Helper to retrieve in-memory transaction for test verification
   */
  static getInMemoryTransaction(id: string): any {
    return IN_MEMORY_TRANSACTIONS.get(id);
  }
}
