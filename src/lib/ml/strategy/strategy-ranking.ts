import {
  ALL_STRATEGY_CLASSES,
  RankedStrategy,
  RecoveryStrategyClass,
  StrategyRankingResult,
} from '../models/model-types';
import { StrategyScorer } from './strategy-scorer';

export class StrategyRankingEngine {
  /**
   * Evaluates and ranks all 7 recovery strategies by Net Expected Value (EV)
   */
  static rankStrategies(params: {
    transactionId: string;
    amount: number;
    strategyProbabilities: Record<RecoveryStrategyClass, number>;
    baseRecoveryProbability: number;
    fatigueScore: number;
    riskScore: number;
  }): StrategyRankingResult {
    const {
      transactionId,
      amount,
      strategyProbabilities,
      baseRecoveryProbability,
      fatigueScore,
      riskScore,
    } = params;

    const scoredStrategies: Omit<RankedStrategy, 'rank'>[] = ALL_STRATEGY_CLASSES.map(strategy => {
      const strategyProb = strategyProbabilities[strategy] ?? 0.0;
      const scored = StrategyScorer.calculateNetEV({
        strategy,
        strategyProbability: strategyProb,
        baseRecoveryProbability,
        amount,
        fatigueScore,
        riskScore,
      });

      return {
        strategy,
        strategyProbability: strategyProb,
        recoveryProbability: scored.recoveryProbability,
        expectedGrossRecovery: scored.expectedGrossRecovery,
        costs: scored.costs,
        netEV: scored.netEV,
        confidence: strategyProb,
      };
    });

    // Sort descending primarily by Net EV, secondarily by strategy probability
    scoredStrategies.sort((a, b) => {
      if (b.netEV !== a.netEV) {
        return b.netEV - a.netEV;
      }
      return b.strategyProbability - a.strategyProbability;
    });

    const rankedStrategies: RankedStrategy[] = scoredStrategies.map((s, idx) => ({
      ...s,
      rank: idx + 1,
    }));

    return {
      transactionId,
      amount,
      rankedStrategies,
      topStrategy: rankedStrategies[0]!,
      generatedAt: new Date().toISOString(),
      isShadowOnly: true,
    };
  }

  /**
   * Generates a readable summary table of the Top-3 strategies for decision audit
   */
  static formatRankingSummary(result: StrategyRankingResult): string[] {
    const lines: string[] = [];
    lines.push(`Strategy Net EV Ranking for Transaction ${result.transactionId} (₹${result.amount.toLocaleString('en-IN')}):`);

    for (let i = 0; i < Math.min(3, result.rankedStrategies.length); i++) {
      const s = result.rankedStrategies[i]!;
      lines.push(
        `  ${s.rank}. ${s.strategy.padEnd(23)} | Net EV: ₹${s.netEV.toLocaleString('en-IN').padStart(8)} | P(Strat): ${(s.strategyProbability * 100).toFixed(1).padStart(5)}% | Est. Gross: ₹${s.expectedGrossRecovery.toLocaleString('en-IN')} | Costs: ₹${s.costs.totalCost}`
      );
    }

    return lines;
  }
}
