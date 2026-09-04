import { RecoveryStrategyClass, RankedStrategy } from '../models/model-types';

export interface StrategyCostConfig {
  directCost: number;
  fatigueMultiplier: number;
  riskMultiplier: number;
}

export const DEFAULT_STRATEGY_COSTS: Record<RecoveryStrategyClass, StrategyCostConfig> = {
  IMMEDIATE_RETRY: { directCost: 0.10, fatigueMultiplier: 0.05, riskMultiplier: 0.01 },
  OPTIMAL_DELAYED_RETRY: { directCost: 0.25, fatigueMultiplier: 0.08, riskMultiplier: 0.02 },
  PAYMENT_LINK: { directCost: 3.20, fatigueMultiplier: 0.15, riskMultiplier: 0.03 },
  WHATSAPP_NUDGE: { directCost: 1.50, fatigueMultiplier: 0.25, riskMultiplier: 0.03 },
  MANDATE_UPDATE: { directCost: 1.00, fatigueMultiplier: 0.10, riskMultiplier: 0.02 },
  HUMAN_ESCALATION: { directCost: 45.00, fatigueMultiplier: 0.10, riskMultiplier: 0.05 },
  DO_NOT_RECOVER: { directCost: 0.00, fatigueMultiplier: 0.00, riskMultiplier: 0.00 },
};

export class StrategyScorer {
  /**
   * Calculates the Net Expected Value (EV) for an individual strategy:
   * Net EV = P(recovery | strategy) * amount - DirectCost - FatiguePenalty - RiskPenalty
   */
  static calculateNetEV(params: {
    strategy: RecoveryStrategyClass;
    strategyProbability: number;
    baseRecoveryProbability: number;
    amount: number;
    fatigueScore: number;
    riskScore: number;
  }): {
    recoveryProbability: number;
    expectedGrossRecovery: number;
    costs: RankedStrategy['costs'];
    netEV: number;
  } {
    const {
      strategy,
      strategyProbability,
      baseRecoveryProbability,
      amount,
      fatigueScore,
      riskScore,
    } = params;

    // 1. If strategy is DO_NOT_RECOVER, zero gross recovery and zero cost
    if (strategy === 'DO_NOT_RECOVER') {
      return {
        recoveryProbability: 0.0,
        expectedGrossRecovery: 0.0,
        costs: { directCost: 0, fatiguePenalty: 0, riskPenalty: 0, totalCost: 0 },
        netEV: 0.0,
      };
    }

    // 2. Modulate conditional probability P(recovery | strategy)
    // Strategy probability scales efficacy around the base recovery probability
    const efficacyFactor = 0.75 + 0.50 * strategyProbability;
    const conditionalRecoveryProb = Math.min(0.99, Math.max(0.01, baseRecoveryProbability * efficacyFactor));

    // 3. Expected Gross Recovery
    const expectedGross = conditionalRecoveryProb * amount;

    // 4. Cost Computations
    const costConfig = DEFAULT_STRATEGY_COSTS[strategy];
    const directCost = costConfig.directCost;
    const fatiguePenalty = (fatigueScore / 100) * costConfig.fatigueMultiplier * Math.min(250, amount * 0.05);
    const riskPenalty = (riskScore / 100) * costConfig.riskMultiplier * Math.min(500, amount * 0.08);

    const totalCost = directCost + fatiguePenalty + riskPenalty;
    const netEV = expectedGross - totalCost;

    return {
      recoveryProbability: Number(conditionalRecoveryProb.toFixed(4)),
      expectedGrossRecovery: Number(expectedGross.toFixed(2)),
      costs: {
        directCost: Number(directCost.toFixed(2)),
        fatiguePenalty: Number(fatiguePenalty.toFixed(2)),
        riskPenalty: Number(riskPenalty.toFixed(2)),
        totalCost: Number(totalCost.toFixed(2)),
      },
      netEV: Number(netEV.toFixed(2)),
    };
  }
}
