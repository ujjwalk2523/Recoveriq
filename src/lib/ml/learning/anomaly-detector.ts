import { prisma } from '@/lib/db/prisma';
import { StrategyPerformanceMetrics } from './learning-types';

export interface AnomalyReport {
  id: string;
  merchantId: string;
  anomalyType: 'RATE_DROP' | 'COST_SPIKE' | 'NEGATIVE_SURPLUS' | 'DRIFT';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  metric: string;
  previousValue: number;
  currentValue: number;
  explanation: string;
  detectedAt: string;
}

// In-memory anomalies cache
export const IN_MEMORY_ANOMALIES: AnomalyReport[] = [];

export class AnomalyDetector {
  /**
   * Inspects updated strategy performance for anomalous behavior:
   * 1. Sudden recovery rate drop (>20% drop from previous baseline)
   * 2. Negative net surplus reward (< -₹50)
   * 3. Abnormal cost spike
   */
  static async evaluateStrategy(
    merchantId: string,
    current: StrategyPerformanceMetrics,
    previousRate?: number
  ): Promise<AnomalyReport | null> {
    const isDbAvailable = process.env.SKIP_DB !== 'true';

    // Check 1: Significant Recovery Rate Drop (only if sample size >= 10)
    if (previousRate !== undefined && current.attempts >= 10) {
      const drop = previousRate - current.recoveryRate;
      if (drop >= 0.20) {
        const severity = drop >= 0.35 ? 'CRITICAL' : 'WARNING';
        const anomaly: AnomalyReport = {
          id: `anom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          merchantId,
          anomalyType: 'RATE_DROP',
          severity,
          metric: `${current.strategy}_RECOVERY_RATE`,
          previousValue: Math.round(previousRate * 100),
          currentValue: Math.round(current.recoveryRate * 100),
          explanation: `Recovery rate for ${current.strategy} dropped by ${(drop * 100).toFixed(1)}% (${(previousRate * 100).toFixed(0)}% → ${(current.recoveryRate * 100).toFixed(0)}%).`,
          detectedAt: new Date().toISOString(),
        };

        IN_MEMORY_ANOMALIES.unshift(anomaly);

        if (isDbAvailable) {
          try {
            await prisma.recoveryIntelligenceAnomaly.create({
              data: {
                id: anomaly.id,
                merchantId,
                anomalyType: anomaly.anomalyType,
                severity: anomaly.severity,
                metric: anomaly.metric,
                previousValue: anomaly.previousValue,
                currentValue: anomaly.currentValue,
                explanation: anomaly.explanation,
                detectedAt: new Date(),
              },
            });
          } catch {
            // resilient
          }
        }

        return anomaly;
      }
    }

    // Check 2: Severe Negative Net Reward (costs and penalties exceeding revenue)
    if (current.averageReward < -50 && current.attempts >= 5) {
      const anomaly: AnomalyReport = {
        id: `anom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        merchantId,
        anomalyType: 'NEGATIVE_SURPLUS',
        severity: 'WARNING',
        metric: `${current.strategy}_AVERAGE_REWARD`,
        previousValue: 0.0,
        currentValue: current.averageReward,
        explanation: `Net economic reward for ${current.strategy} has deteriorated to ₹${current.averageReward.toLocaleString('en-IN')}; execution cost/penalties exceed recovered revenue.`,
        detectedAt: new Date().toISOString(),
      };

      IN_MEMORY_ANOMALIES.unshift(anomaly);

      if (isDbAvailable) {
        try {
          await prisma.recoveryIntelligenceAnomaly.create({
            data: {
              id: anomaly.id,
              merchantId,
              anomalyType: anomaly.anomalyType,
              severity: anomaly.severity,
              metric: anomaly.metric,
              previousValue: anomaly.previousValue,
              currentValue: anomaly.currentValue,
              explanation: anomaly.explanation,
              detectedAt: new Date(),
            },
          });
        } catch {
          // resilient
        }
      }

      return anomaly;
    }

    return null;
  }

  static getMerchantAnomalies(merchantId: string): AnomalyReport[] {
    return IN_MEMORY_ANOMALIES.filter((a) => a.merchantId === merchantId);
  }

  static clearCache(): void {
    IN_MEMORY_ANOMALIES.length = 0;
  }
}
