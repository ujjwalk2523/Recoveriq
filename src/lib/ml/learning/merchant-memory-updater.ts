import { prisma } from '@/lib/db/prisma';
import { RecoveryLearningEventPayload } from './learning-types';
import { StrategyMemoryUpdater } from './strategy-memory-updater';
import { TimingMemoryUpdater } from './timing-memory-updater';
import { FailurePatternUpdater } from './failure-pattern-updater';
import { ConfidenceEngine } from './confidence-engine';
import { DecayEngine } from './decay-engine';

export const IN_MEMORY_MERCHANT_INTELLIGENCE = new Map<string, any>();

export class MerchantMemoryUpdater {
  /**
   * Recomputes and updates the merchant-scoped recovery intelligence aggregate.
   */
  static async updateMemory(event: RecoveryLearningEventPayload): Promise<any> {
    const { merchantId, outcome, recoveredAmount, recoveryCost, reward } = event;
    const isSuccess = outcome === 'RECOVERY_SUCCEEDED';
    const isDbAvailable = process.env.SKIP_DB !== 'true';

    // 1. Fetch current or initialize
    let intelligence = IN_MEMORY_MERCHANT_INTELLIGENCE.get(merchantId) || {
      merchantId,
      totalFailedPayments: 0,
      totalRecoveredPayments: 0,
      recoveryRate: 0.5,
      totalRecoveryRevenue: 0.0,
      totalRecoveryCost: 0.0,
      totalNetRecoveryRevenue: 0.0,
      averageReward: 0.0,
      bestStrategy: null,
      bestTimingBucket: null,
      intelligenceQuality: 50.0,
      evidenceLevel: 'LOW',
      coldStart: true,
      coldStartReason: 'Insufficient historical recovery observations (<30 samples).',
      modelVersion: 'RecoverIQ-Intelligence-v1.0',
      lastUpdatedAt: new Date().toISOString(),
    };

    // 2. Incremental updates
    intelligence.totalFailedPayments += isSuccess ? 0 : 1;
    intelligence.totalRecoveredPayments += isSuccess ? 1 : 0;
    const totalObservations = intelligence.totalRecoveredPayments + intelligence.totalFailedPayments;

    intelligence.totalRecoveryRevenue = Math.round((intelligence.totalRecoveryRevenue + recoveredAmount) * 100) / 100;
    intelligence.totalRecoveryCost = Math.round((intelligence.totalRecoveryCost + recoveryCost) * 100) / 100;
    intelligence.totalNetRecoveryRevenue = Math.round((intelligence.totalRecoveryRevenue - intelligence.totalRecoveryCost) * 100) / 100;

    intelligence.recoveryRate = DecayEngine.smoothRate(intelligence.totalRecoveredPayments, totalObservations);
    intelligence.averageReward = Math.round(((intelligence.averageReward * (totalObservations - 1) + reward) / totalObservations) * 100) / 100;

    // 3. Find best strategy and best timing bucket
    const strategies = StrategyMemoryUpdater.getMerchantStrategies(merchantId);
    if (strategies.length > 0) {
      const sorted = [...strategies].sort((a, b) => b.recoveryRate - a.recoveryRate);
      intelligence.bestStrategy = sorted[0].strategy;
      intelligence.strategyPerformance = strategies;
    }

    const timing = TimingMemoryUpdater.getMerchantTiming(merchantId);
    if (timing.length > 0) {
      const sortedTiming = [...timing].sort((a, b) => b.recoveryRate - a.recoveryRate);
      intelligence.bestTimingBucket = sortedTiming[0].bucket;
      intelligence.timingPerformance = timing;
    }

    const failurePatterns = FailurePatternUpdater.getMerchantPatterns(merchantId);
    intelligence.failureCategoryPerformance = failurePatterns;

    // 4. Evaluate Quality Score & Evidence Tier
    const quality = ConfidenceEngine.calculateQualityScore({
      totalObservations,
      lastUpdatedMinutesAgo: 0,
      distinctStrategiesObserved: strategies.length,
      successRate: intelligence.recoveryRate,
    });

    intelligence.intelligenceQuality = quality.score;
    intelligence.evidenceLevel = quality.evidenceLevel;
    intelligence.coldStart = quality.isColdStart;
    intelligence.coldStartReason = quality.coldStartReason || null;
    intelligence.lastUpdatedAt = new Date().toISOString();

    // Store in-memory
    IN_MEMORY_MERCHANT_INTELLIGENCE.set(merchantId, { ...intelligence });

    // Store in DB if available
    if (isDbAvailable) {
      try {
        await prisma.merchantRecoveryIntelligence.upsert({
          where: { merchantId },
          update: {
            totalFailedPayments: intelligence.totalFailedPayments,
            totalRecoveredPayments: intelligence.totalRecoveredPayments,
            recoveryRate: intelligence.recoveryRate,
            totalRecoveryRevenue: intelligence.totalRecoveryRevenue,
            totalRecoveryCost: intelligence.totalRecoveryCost,
            totalNetRecoveryRevenue: intelligence.totalNetRecoveryRevenue,
            averageReward: intelligence.averageReward,
            bestStrategy: intelligence.bestStrategy,
            bestTimingBucket: intelligence.bestTimingBucket,
            strategyPerformance: intelligence.strategyPerformance as any,
            timingPerformance: intelligence.timingPerformance as any,
            failureCategoryPerformance: intelligence.failureCategoryPerformance as any,
            intelligenceQuality: intelligence.intelligenceQuality,
            evidenceLevel: intelligence.evidenceLevel,
            coldStart: intelligence.coldStart,
            coldStartReason: intelligence.coldStartReason,
            modelVersion: intelligence.modelVersion,
            lastUpdatedAt: new Date(),
          },
          create: {
            merchantId,
            totalFailedPayments: intelligence.totalFailedPayments,
            totalRecoveredPayments: intelligence.totalRecoveredPayments,
            recoveryRate: intelligence.recoveryRate,
            totalRecoveryRevenue: intelligence.totalRecoveryRevenue,
            totalRecoveryCost: intelligence.totalRecoveryCost,
            totalNetRecoveryRevenue: intelligence.totalNetRecoveryRevenue,
            averageReward: intelligence.averageReward,
            bestStrategy: intelligence.bestStrategy,
            bestTimingBucket: intelligence.bestTimingBucket,
            strategyPerformance: intelligence.strategyPerformance as any,
            timingPerformance: intelligence.timingPerformance as any,
            failureCategoryPerformance: intelligence.failureCategoryPerformance as any,
            intelligenceQuality: intelligence.intelligenceQuality,
            evidenceLevel: intelligence.evidenceLevel,
            coldStart: intelligence.coldStart,
            coldStartReason: intelligence.coldStartReason,
            modelVersion: intelligence.modelVersion,
          },
        });
      } catch {
        // resilient
      }
    }

    return intelligence;
  }

  static getIntelligence(merchantId: string): any {
    return IN_MEMORY_MERCHANT_INTELLIGENCE.get(merchantId);
  }

  static clearCache(): void {
    IN_MEMORY_MERCHANT_INTELLIGENCE.clear();
  }
}
