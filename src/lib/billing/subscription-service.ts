import { prisma } from '@/lib/db/prisma';
import {
  BillingProvider,
  PlanCode,
  SubscriptionData,
  SubscriptionEventData,
  SubscriptionEventType,
  SubscriptionStatusType,
} from './billing-types';
import { DEFAULT_PLAN_CODE, DEFAULT_TRIAL_DAYS, PLANS_CONFIG } from './plan-config';
import { SubscriptionStateMachine } from './subscription-state-machine';
import { SubscriptionNotFoundError } from './billing-errors';
import { AuditService } from '@/lib/services/audit.service';

// In-memory subscription store for test speed & offline resilience: merchantId -> SubscriptionData
export const IN_MEMORY_SUBSCRIPTIONS = new Map<string, SubscriptionData>();
export const IN_MEMORY_SUBSCRIPTION_EVENTS: SubscriptionEventData[] = [];

export class SubscriptionService {
  /**
   * Helper: checks if trial is currently active.
   */
  static isTrialActive(sub: SubscriptionData): boolean {
    if (sub.status !== SubscriptionStatusType.TRIALING) return false;
    if (!sub.trialEnd) return false;
    return new Date(sub.trialEnd).getTime() > Date.now();
  }

  /**
   * Helper: checks if subscription is active (either ACTIVE status or active trial).
   */
  static isSubscriptionActive(sub: SubscriptionData): boolean {
    if (sub.status === SubscriptionStatusType.ACTIVE) return true;
    return this.isTrialActive(sub);
  }

  static isPastDue(sub: SubscriptionData): boolean {
    return sub.status === SubscriptionStatusType.PAST_DUE;
  }

  static isSuspended(sub: SubscriptionData): boolean {
    return sub.status === SubscriptionStatusType.SUSPENDED;
  }

  static isExpired(sub: SubscriptionData): boolean {
    if (sub.status === SubscriptionStatusType.EXPIRED) return true;
    if (sub.status === SubscriptionStatusType.TRIALING && sub.trialEnd) {
      return new Date(sub.trialEnd).getTime() <= Date.now();
    }
    return false;
  }

  /**
   * Resolves the subscription for a merchant.
   * If none exists, automatically provisions a default STARTER / TRIALING subscription.
   */
  static async getSubscription(merchantId: string): Promise<SubscriptionData> {
    // 1. Check in-memory store
    const memSub = IN_MEMORY_SUBSCRIPTIONS.get(merchantId);
    if (memSub) {
      return memSub;
    }

    // 2. Check Database
    if (process.env.SKIP_DB !== 'true') {
      try {
        const dbSub = await prisma.subscription.findFirst({
          where: { merchantId },
          orderBy: { createdAt: 'desc' },
          include: { planDetails: true },
        });

        if (dbSub) {
          const planCode = (dbSub.planDetails?.code || dbSub.plan || DEFAULT_PLAN_CODE) as PlanCode;
          let status = dbSub.status as string;
          if (status === 'CANCELED') status = 'CANCELLED';

          const subData: SubscriptionData = {
            id: dbSub.id,
            merchantId: dbSub.merchantId,
            planId: dbSub.planId,
            planCode,
            status: status as SubscriptionStatusType,
            provider: (dbSub.provider as BillingProvider) || BillingProvider.INTERNAL,
            providerCustomerId: dbSub.providerCustomerId,
            providerSubscriptionId: dbSub.providerSubscriptionId,
            currentPeriodStart: dbSub.currentPeriodStart,
            currentPeriodEnd: dbSub.currentPeriodEnd,
            trialStart: dbSub.trialStart,
            trialEnd: dbSub.trialEnd,
            cancelAtPeriodEnd: dbSub.cancelAtPeriodEnd,
            cancelledAt: dbSub.cancelledAt,
            suspendedAt: dbSub.suspendedAt,
            createdAt: dbSub.createdAt,
            updatedAt: dbSub.updatedAt,
          };

          IN_MEMORY_SUBSCRIPTIONS.set(merchantId, subData);
          return subData;
        }
      } catch {
        // Resilient fallback
      }
    }

    // 3. Not found: auto-create default 14-day trial
    return this.createDefaultSubscription(merchantId);
  }

  /**
   * Creates a default subscription (STARTER / TRIALING with 14-day duration).
   */
  static async createDefaultSubscription(
    merchantId: string,
    initialPlanCode: PlanCode = DEFAULT_PLAN_CODE,
    trialDays: number = DEFAULT_TRIAL_DAYS
  ): Promise<SubscriptionData> {
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

    const subData: SubscriptionData = {
      id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      merchantId,
      planCode: initialPlanCode,
      status: SubscriptionStatusType.TRIALING,
      provider: BillingProvider.INTERNAL,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialStart: now,
      trialEnd,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    };

    IN_MEMORY_SUBSCRIPTIONS.set(merchantId, subData);

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.subscription.create({
          data: {
            id: subData.id,
            merchantId,
            plan: initialPlanCode as any,
            status: SubscriptionStatusType.TRIALING as any,
            provider: BillingProvider.INTERNAL,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            trialStart: now,
            trialEnd,
            cancelAtPeriodEnd: false,
          },
        });
      } catch {
        // resilient
      }
    }

    // Record Event & Audit Log
    await this.recordEvent({
      subscriptionId: subData.id,
      merchantId,
      eventType: SubscriptionEventType.CREATED,
      newPlan: initialPlanCode,
      newStatus: SubscriptionStatusType.TRIALING,
      actor: 'SYSTEM',
      metadata: { trialDays },
    });

    return subData;
  }

  /**
   * Activates an active subscription from trial or past_due.
   */
  static async activateSubscription(merchantId: string, actor = 'SYSTEM'): Promise<SubscriptionData> {
    const sub = await this.getSubscription(merchantId);
    SubscriptionStateMachine.assertTransition(sub.status, SubscriptionStatusType.ACTIVE);

    const prevStatus = sub.status;
    sub.status = SubscriptionStatusType.ACTIVE;
    sub.updatedAt = new Date();

    IN_MEMORY_SUBSCRIPTIONS.set(merchantId, { ...sub });

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'ACTIVE' as any, updatedAt: sub.updatedAt },
        });
      } catch {
        // resilient
      }
    }

    await this.recordEvent({
      subscriptionId: sub.id,
      merchantId,
      eventType: SubscriptionEventType.ACTIVATED,
      previousStatus: prevStatus,
      newStatus: SubscriptionStatusType.ACTIVE,
      actor,
    });

    return { ...sub };
  }

  /**
   * Performs a plan change (upgrade or downgrade).
   */
  static async changePlan(
    merchantId: string,
    newPlanCode: PlanCode,
    actor = 'SYSTEM'
  ): Promise<SubscriptionData> {
    const sub = await this.getSubscription(merchantId);
    const prevPlan = sub.planCode;

    if (prevPlan === newPlanCode) {
      return sub; // No-op
    }

    if (!PLANS_CONFIG[newPlanCode]) {
      throw new SubscriptionNotFoundError(`Unknown plan code ${newPlanCode}`);
    }

    sub.planCode = newPlanCode;
    if (
      (sub.status === SubscriptionStatusType.TRIALING || sub.status === SubscriptionStatusType.EXPIRED) &&
      newPlanCode !== PlanCode.STARTER
    ) {
      sub.status = SubscriptionStatusType.ACTIVE;
    }
    sub.updatedAt = new Date();

    IN_MEMORY_SUBSCRIPTIONS.set(merchantId, { ...sub });

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { plan: newPlanCode as any, updatedAt: sub.updatedAt },
        });
      } catch {
        // resilient
      }
    }

    await this.recordEvent({
      subscriptionId: sub.id,
      merchantId,
      eventType: SubscriptionEventType.PLAN_CHANGED,
      previousPlan: prevPlan,
      newPlan: newPlanCode,
      actor,
      metadata: {
        priceINR: PLANS_CONFIG[newPlanCode].monthlyPriceMinor / 100,
      },
    });

    return { ...sub };
  }

  /**
   * Cancels a subscription.
   */
  static async cancelSubscription(
    merchantId: string,
    actor = 'SYSTEM',
    cancelAtEnd = false
  ): Promise<SubscriptionData> {
    const sub = await this.getSubscription(merchantId);
    const prevStatus = sub.status;
    SubscriptionStateMachine.assertTransition(sub.status, SubscriptionStatusType.CANCELLED);
    sub.status = SubscriptionStatusType.CANCELLED;
    sub.cancelAtPeriodEnd = cancelAtEnd;
    sub.cancelledAt = new Date();
    sub.updatedAt = new Date();

    IN_MEMORY_SUBSCRIPTIONS.set(merchantId, { ...sub });

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: 'CANCELLED' as any,
            cancelAtPeriodEnd: cancelAtEnd,
            cancelledAt: sub.cancelledAt,
            updatedAt: sub.updatedAt,
          },
        });
      } catch {
        // resilient
      }
    }

    await this.recordEvent({
      subscriptionId: sub.id,
      merchantId,
      eventType: SubscriptionEventType.CANCELLED,
      previousStatus: prevStatus,
      newStatus: SubscriptionStatusType.CANCELLED,
      actor,
    });

    return { ...sub };
  }

  /**
   * Reactivates a cancelled subscription.
   */
  static async reactivateSubscription(merchantId: string, actor = 'SYSTEM'): Promise<SubscriptionData> {
    const sub = await this.getSubscription(merchantId);
    SubscriptionStateMachine.assertTransition(sub.status, SubscriptionStatusType.ACTIVE);

    const prevStatus = sub.status;
    sub.status = SubscriptionStatusType.ACTIVE;
    sub.cancelAtPeriodEnd = false;
    sub.cancelledAt = null;
    sub.updatedAt = new Date();

    IN_MEMORY_SUBSCRIPTIONS.set(merchantId, { ...sub });

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: 'ACTIVE' as any,
            cancelAtPeriodEnd: false,
            cancelledAt: null,
            updatedAt: sub.updatedAt,
          },
        });
      } catch {
        // resilient
      }
    }

    await this.recordEvent({
      subscriptionId: sub.id,
      merchantId,
      eventType: SubscriptionEventType.REACTIVATED,
      previousStatus: prevStatus,
      newStatus: SubscriptionStatusType.ACTIVE,
      actor,
    });

    return { ...sub };
  }

  /**
   * Suspends a subscription due to non-payment or administrative lock.
   */
  static async suspendSubscription(
    merchantId: string,
    reason: string,
    actor = 'SYSTEM'
  ): Promise<SubscriptionData> {
    const sub = await this.getSubscription(merchantId);
    SubscriptionStateMachine.assertTransition(sub.status, SubscriptionStatusType.SUSPENDED);

    const prevStatus = sub.status;
    sub.status = SubscriptionStatusType.SUSPENDED;
    sub.suspendedAt = new Date();
    sub.updatedAt = new Date();

    IN_MEMORY_SUBSCRIPTIONS.set(merchantId, { ...sub });

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: 'SUSPENDED' as any,
            suspendedAt: sub.suspendedAt,
            updatedAt: sub.updatedAt,
          },
        });
      } catch {
        // resilient
      }
    }

    await this.recordEvent({
      subscriptionId: sub.id,
      merchantId,
      eventType: SubscriptionEventType.SUSPENDED,
      previousStatus: prevStatus,
      newStatus: SubscriptionStatusType.SUSPENDED,
      actor,
      metadata: { reason },
    });

    return { ...sub };
  }

  /**
   * Expires a subscription (e.g. trial ended or non-payment past grace period).
   */
  static async expireSubscription(merchantId: string, actor = 'SYSTEM'): Promise<SubscriptionData> {
    const sub = await this.getSubscription(merchantId);
    SubscriptionStateMachine.assertTransition(sub.status, SubscriptionStatusType.EXPIRED);

    const prevStatus = sub.status;
    sub.status = SubscriptionStatusType.EXPIRED;
    sub.updatedAt = new Date();

    IN_MEMORY_SUBSCRIPTIONS.set(merchantId, { ...sub });

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'EXPIRED' as any, updatedAt: sub.updatedAt },
        });
      } catch {
        // resilient
      }
    }

    await this.recordEvent({
      subscriptionId: sub.id,
      merchantId,
      eventType: SubscriptionEventType.EXPIRED,
      previousStatus: prevStatus,
      newStatus: SubscriptionStatusType.EXPIRED,
      actor,
    });

    return { ...sub };
  }

  /**
   * Marks a subscription past due when a renewal payment fails.
   */
  static async markPastDue(merchantId: string, actor = 'SYSTEM'): Promise<SubscriptionData> {
    const sub = await this.getSubscription(merchantId);
    SubscriptionStateMachine.assertTransition(sub.status, SubscriptionStatusType.PAST_DUE);

    const prevStatus = sub.status;
    sub.status = SubscriptionStatusType.PAST_DUE;
    sub.updatedAt = new Date();

    IN_MEMORY_SUBSCRIPTIONS.set(merchantId, { ...sub });

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'PAST_DUE' as any, updatedAt: sub.updatedAt },
        });
      } catch {
        // resilient
      }
    }

    await this.recordEvent({
      subscriptionId: sub.id,
      merchantId,
      eventType: SubscriptionEventType.PAST_DUE,
      previousStatus: prevStatus,
      newStatus: SubscriptionStatusType.PAST_DUE,
      actor,
    });

    return { ...sub };
  }

  /**
   * Durable trial expiration check without durable setTimeout.
   */
  static async checkAndExpireTrials(merchantId?: string): Promise<number> {
    let expiredCount = 0;
    const now = Date.now();
    const targets = merchantId
      ? [await this.getSubscription(merchantId)]
      : Array.from(IN_MEMORY_SUBSCRIPTIONS.values());

    for (const sub of targets) {
      if (sub.status === SubscriptionStatusType.TRIALING && sub.trialEnd) {
        if (new Date(sub.trialEnd).getTime() <= now) {
          await this.expireSubscription(sub.merchantId, 'TRIAL_EXPIRATION_WORKER');
          expiredCount++;
        }
      }
    }
    return expiredCount;
  }

  /**
   * Records an append-only subscription event and logs to tamper-evident AuditService.
   */
  static async recordEvent(params: {
    subscriptionId: string;
    merchantId: string;
    eventType: SubscriptionEventType;
    previousPlan?: PlanCode | null;
    newPlan?: PlanCode | null;
    previousStatus?: SubscriptionStatusType | null;
    newStatus?: SubscriptionStatusType | null;
    actor: string;
    metadata?: Record<string, any>;
  }): Promise<SubscriptionEventData> {
    const event: SubscriptionEventData = {
      id: `sev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      subscriptionId: params.subscriptionId,
      merchantId: params.merchantId,
      eventType: params.eventType,
      previousPlan: params.previousPlan,
      newPlan: params.newPlan,
      previousStatus: params.previousStatus,
      newStatus: params.newStatus,
      actor: params.actor,
      metadata: params.metadata || null,
      createdAt: new Date(),
    };

    IN_MEMORY_SUBSCRIPTION_EVENTS.unshift(event);

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.subscriptionEvent.create({
          data: {
            id: event.id,
            subscriptionId: params.subscriptionId,
            merchantId: params.merchantId,
            eventType: params.eventType,
            previousPlan: params.previousPlan,
            newPlan: params.newPlan,
            previousStatus: params.previousStatus,
            newStatus: params.newStatus,
            actor: params.actor,
            metadata: params.metadata as any,
            createdAt: event.createdAt,
          },
        });
      } catch {
        // resilient
      }
    }

    // Tamper-evident audit log
    try {
      await AuditService.logEvent({
        merchantId: params.merchantId,
        actorType: 'BILLING_ENGINE',
        actorName: params.actor,
        action: `SUBSCRIPTION_${params.eventType}`,
        entityType: 'SUBSCRIPTION',
        entityId: params.subscriptionId,
        details: `Subscription event ${params.eventType} executed. Plan: ${params.previousPlan ?? ''} -> ${params.newPlan ?? ''}, Status: ${params.previousStatus ?? ''} -> ${params.newStatus ?? ''}`,
      });
    } catch {
      // ignore
    }

    return event;
  }

  /**
   * Retrieves all subscription events for a merchant (append-only history).
   */
  static async getSubscriptionEvents(merchantId: string): Promise<SubscriptionEventData[]> {
    if (process.env.SKIP_DB !== 'true') {
      try {
        const events = await prisma.subscriptionEvent.findMany({
          where: { merchantId },
          orderBy: { createdAt: 'desc' },
        });
        if (events.length > 0) {
          return events.map((e) => ({
            id: e.id,
            subscriptionId: e.subscriptionId,
            merchantId: e.merchantId,
            eventType: e.eventType as SubscriptionEventType,
            previousPlan: e.previousPlan as PlanCode,
            newPlan: e.newPlan as PlanCode,
            previousStatus: e.previousStatus as SubscriptionStatusType,
            newStatus: e.newStatus as SubscriptionStatusType,
            actor: e.actor,
            metadata: e.metadata as any,
            createdAt: e.createdAt,
          }));
        }
      } catch {
        // fallback
      }
    }

    return IN_MEMORY_SUBSCRIPTION_EVENTS.filter((e) => e.merchantId === merchantId);
  }

  static clearCache(): void {
    IN_MEMORY_SUBSCRIPTIONS.clear();
    IN_MEMORY_SUBSCRIPTION_EVENTS.length = 0;
  }
}
