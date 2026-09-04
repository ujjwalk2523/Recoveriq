import { prisma } from '@/lib/db/prisma';
import { RecoveryLearningEventPayload } from './learning-types';
import { DecayEngine } from './decay-engine';
import { ConfidenceEngine } from './confidence-engine';
import { SegmentEngine } from './segment-engine';

// In-memory customer memory cache for offline test resilience
export const IN_MEMORY_CUSTOMER_MEMORIES = new Map<string, any>();

export class CustomerMemoryUpdater {
  /**
   * Incrementally updates customer behavioral memory based on observed recovery outcome.
   */
  static async updateMemory(event: RecoveryLearningEventPayload): Promise<boolean> {
    if (!event.customerId) return false;

    const isSuccess = event.outcome === 'RECOVERY_SUCCEEDED';
    const isDbAvailable = process.env.SKIP_DB !== 'true';

    // 1. Fetch current profile or create baseline
    let profile: any = null;
    if (isDbAvailable) {
      try {
        profile = await prisma.customerRecoveryProfile.findUnique({
          where: { customerId: event.customerId },
          include: { customer: true },
        });
      } catch {
        // DB offline fallback
      }
    }

    if (!profile) {
      profile = IN_MEMORY_CUSTOMER_MEMORIES.get(event.customerId) || {
        customerId: event.customerId,
        pastRecoveries: 0,
        fatigueScore: 15,
        riskScore: 10,
        totalFailedPayments: 0,
        totalRecoveredPayments: 0,
        totalRecoveryAttempts: 0,
        recoveryRate: 0.5,
        avgRecoveryDelayMinutes: 0.0,
        preferredChannel: 'WHATSAPP',
        upiRecoveryRate: 0.5,
        cardRecoveryRate: 0.5,
        linkConversionRate: 0.5,
        whatsappConversionRate: 0.5,
        retryConversionRate: 0.5,
        behavioralSegment: 'NEW_CUSTOMER',
        strategySuccessCounts: {},
        strategyFailureCounts: {},
        evidenceLevel: 'LOW',
        customer: { lifetimeValue: event.amount },
      };
    }

    // 2. Compute incremental counters
    const newTotalAttempts = (profile.totalRecoveryAttempts || 0) + 1;
    const newTotalRecovered = (profile.totalRecoveredPayments || 0) + (isSuccess ? 1 : 0);
    const newTotalFailed = (profile.totalFailedPayments || 0) + (isSuccess ? 0 : 1);

    // 3. Compute Beta-Binomial smoothed recovery rate
    const smoothedRate = DecayEngine.smoothRate(newTotalRecovered, newTotalAttempts);

    // 4. Update delay statistics if delay was observed
    let newAvgDelay = profile.avgRecoveryDelayMinutes || 0.0;
    if (isSuccess && event.recoveryDelayMinutes !== undefined) {
      newAvgDelay = profile.totalRecoveredPayments === 0
        ? event.recoveryDelayMinutes
        : (profile.avgRecoveryDelayMinutes * profile.totalRecoveredPayments + event.recoveryDelayMinutes) / newTotalRecovered;
      newAvgDelay = Math.round(newAvgDelay * 10) / 10;
    }

    // 5. Update strategy counts
    const successCounts = { ...(profile.strategySuccessCounts || {}) };
    const failureCounts = { ...(profile.strategyFailureCounts || {}) };
    if (isSuccess) {
      successCounts[event.strategy] = (successCounts[event.strategy] || 0) + 1;
    } else {
      failureCounts[event.strategy] = (failureCounts[event.strategy] || 0) + 1;
    }

    // 6. Update channel-specific conversion rates with smoothing
    const strategy = event.strategy;
    let upiRate = profile.upiRecoveryRate || 0.5;
    let cardRate = profile.cardRecoveryRate || 0.5;
    let linkRate = profile.linkConversionRate || 0.5;
    let whatsappRate = profile.whatsappConversionRate || 0.5;
    let retryRate = profile.retryConversionRate || 0.5;

    if (event.paymentMethod === 'upi') {
      const upiSucc = (successCounts['UPI'] || 0) + (isSuccess ? 1 : 0);
      upiRate = DecayEngine.smoothRate(upiSucc, (profile.totalRecoveryAttempts || 0) + 1);
    } else if (event.paymentMethod === 'card') {
      const cardSucc = (successCounts['CARD'] || 0) + (isSuccess ? 1 : 0);
      cardRate = DecayEngine.smoothRate(cardSucc, (profile.totalRecoveryAttempts || 0) + 1);
    }

    if (strategy === 'PAYMENT_LINK') {
      const linkSucc = successCounts['PAYMENT_LINK'] || 0;
      const linkAtt = linkSucc + (failureCounts['PAYMENT_LINK'] || 0);
      linkRate = DecayEngine.smoothRate(linkSucc, linkAtt);
    } else if (strategy === 'WHATSAPP_NUDGE') {
      const waSucc = successCounts['WHATSAPP_NUDGE'] || 0;
      const waAtt = waSucc + (failureCounts['WHATSAPP_NUDGE'] || 0);
      whatsappRate = DecayEngine.smoothRate(waSucc, waAtt);
    } else if (strategy === 'IMMEDIATE_RETRY' || strategy === 'OPTIMAL_DELAYED_RETRY') {
      const retSucc = (successCounts['IMMEDIATE_RETRY'] || 0) + (successCounts['OPTIMAL_DELAYED_RETRY'] || 0);
      const retAtt = retSucc + (failureCounts['IMMEDIATE_RETRY'] || 0) + (failureCounts['OPTIMAL_DELAYED_RETRY'] || 0);
      retryRate = DecayEngine.smoothRate(retSucc, retAtt);
    }

    // 7. Re-evaluate Behavioral Segment
    const segmentResult = SegmentEngine.classifySegment({
      totalAttempts: newTotalAttempts,
      totalRecovered: newTotalRecovered,
      recoveryRate: smoothedRate,
      lifetimeValue: profile.customer?.lifetimeValue || event.amount * 2,
      fatigueScore: profile.fatigueScore || 15,
      riskScore: profile.riskScore || 10,
      retrySuccessCount: (successCounts['IMMEDIATE_RETRY'] || 0) + (successCounts['OPTIMAL_DELAYED_RETRY'] || 0),
      retryFailureCount: (failureCounts['IMMEDIATE_RETRY'] || 0) + (failureCounts['OPTIMAL_DELAYED_RETRY'] || 0),
      linkSuccessCount: successCounts['PAYMENT_LINK'] || 0,
      whatsappSuccessCount: successCounts['WHATSAPP_NUDGE'] || 0,
    });

    const evidenceLevel = ConfidenceEngine.getEvidenceTier(newTotalAttempts);

    // Determine preferred channel based on conversion rates
    let preferredChannel = profile.preferredChannel || 'WHATSAPP';
    if (linkRate > whatsappRate && linkRate > retryRate && (successCounts['PAYMENT_LINK'] || 0) > 0) {
      preferredChannel = 'PAYMENT_LINK';
    } else if (retryRate > whatsappRate && (successCounts['IMMEDIATE_RETRY'] || 0) > 0) {
      preferredChannel = 'GATEWAY_RETRY';
    } else if (whatsappRate >= 0.5) {
      preferredChannel = 'WHATSAPP';
    }

    const updatedData = {
      totalFailedPayments: newTotalFailed,
      totalRecoveredPayments: newTotalRecovered,
      totalRecoveryAttempts: newTotalAttempts,
      recoveryRate: smoothedRate,
      avgRecoveryDelayMinutes: newAvgDelay,
      lastSuccessfulStrategy: isSuccess ? strategy : profile.lastSuccessfulStrategy,
      lastSuccessfulDelayMinutes: isSuccess ? (event.recoveryDelayMinutes ?? newAvgDelay) : profile.lastSuccessfulDelayMinutes,
      upiRecoveryRate: upiRate,
      cardRecoveryRate: cardRate,
      linkConversionRate: linkRate,
      whatsappConversionRate: whatsappRate,
      retryConversionRate: retryRate,
      behavioralSegment: segmentResult.primarySegment,
      strategySuccessCounts: successCounts,
      strategyFailureCounts: failureCounts,
      evidenceLevel,
      preferredChannel,
      lastRecoveryAt: isSuccess ? new Date() : profile.lastRecoveryAt,
    };

    // Save to memory
    IN_MEMORY_CUSTOMER_MEMORIES.set(event.customerId, {
      ...profile,
      ...updatedData,
      updatedAt: new Date(),
    });

    // Save to DB if available
    if (isDbAvailable) {
      try {
        await prisma.customerRecoveryProfile.upsert({
          where: { customerId: event.customerId },
          update: updatedData,
          create: {
            customerId: event.customerId,
            ...updatedData,
          },
        });
      } catch {
        // resilient
      }
    }

    return true;
  }

  static getMemory(customerId: string): any {
    return IN_MEMORY_CUSTOMER_MEMORIES.get(customerId);
  }

  static clearCache(): void {
    IN_MEMORY_CUSTOMER_MEMORIES.clear();
  }
}
