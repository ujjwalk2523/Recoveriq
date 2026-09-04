import { BanditDecisionResponse, ContextVectorInput } from './bandit-types';
import { prisma } from '../../db/prisma';

export interface BanditLedgerEntry {
  id: string;
  merchantId: string;
  transactionId: string;
  contextSnapshot: ContextVectorInput;
  candidateActions: string[];
  selectedAction: string;
  selectionMode: 'EXPLOIT' | 'EXPLORE';
  actionScores: Record<string, number>;
  expectedReward: number;
  explorationProbability: number;
  actualReward?: number;
  outcome?: string;
  recoveredAmount?: number;
  modelVersion: string;
  algorithm: string;
  policyDecision?: string;
  policyReason?: string;
  createdAt: string;
  resolvedAt?: string;
}

export class BanditLedger {
  private static inMemoryLedger: Map<string, BanditLedgerEntry> = new Map();

  /**
   * Logs bandit recommendation with full decision-time context snapshot
   */
  static async recordDecision(params: {
    decisionId: string;
    merchantId: string;
    transactionId: string;
    context: ContextVectorInput;
    candidateActions: string[];
    decision: BanditDecisionResponse;
    policyDecision?: string;
    policyReason?: string;
  }): Promise<BanditLedgerEntry> {
    const entry: BanditLedgerEntry = {
      id: params.decisionId,
      merchantId: params.merchantId,
      transactionId: params.transactionId,
      contextSnapshot: params.context,
      candidateActions: params.candidateActions,
      selectedAction: params.decision.selected_action,
      selectionMode: params.decision.selection_mode,
      actionScores: params.decision.action_scores,
      expectedReward: params.decision.expected_reward,
      explorationProbability: params.decision.exploration_probability,
      modelVersion: params.decision.model_version,
      algorithm: params.decision.algorithm,
      policyDecision: params.policyDecision,
      policyReason: params.policyReason,
      createdAt: new Date().toISOString(),
    };

    this.inMemoryLedger.set(params.decisionId, entry);

    // Persist to Prisma if DB connection is active and not in isolated test mode
    if (process.env.NODE_ENV !== 'test' && !process.env.SKIP_DB) {
      try {
        await prisma.banditDecision.create({
          data: {
            id: entry.id,
            merchantId: entry.merchantId,
            transactionId: entry.transactionId,
            contextSnapshot: entry.contextSnapshot as any,
            candidateActions: entry.candidateActions,
            selectedAction: entry.selectedAction,
            selectionMode: entry.selectionMode,
            actionScores: entry.actionScores as any,
            expectedReward: entry.expectedReward,
            explorationProbability: entry.explorationProbability,
            modelVersion: entry.modelVersion,
            algorithm: entry.algorithm,
            policyDecision: entry.policyDecision,
            policyReason: entry.policyReason,
          },
        });
      } catch {
        // Graceful fallback to in-memory ledger
      }
    }

    return entry;
  }

  /**
   * Resolves decision with real-world outcome and actual reward
   */
  static async recordOutcome(params: {
    decisionId: string;
    actualReward: number;
    outcome: string;
    recoveredAmount: number;
  }): Promise<BanditLedgerEntry | null> {
    const entry = this.inMemoryLedger.get(params.decisionId);
    if (entry) {
      entry.actualReward = params.actualReward;
      entry.outcome = params.outcome;
      entry.recoveredAmount = params.recoveredAmount;
      entry.resolvedAt = new Date().toISOString();
    }

    if (process.env.NODE_ENV !== 'test' && !process.env.SKIP_DB) {
      try {
        await prisma.banditDecision.update({
          where: { id: params.decisionId },
          data: {
            actualReward: params.actualReward,
            outcome: params.outcome,
            recoveredAmount: params.recoveredAmount,
            resolvedAt: new Date(),
          },
        });
      } catch {
        // Graceful fallback
      }
    }

    return entry || null;
  }

  static getDecision(decisionId: string): BanditLedgerEntry | undefined {
    return this.inMemoryLedger.get(decisionId);
  }

  static getMerchantDecisions(merchantId: string): BanditLedgerEntry[] {
    return Array.from(this.inMemoryLedger.values()).filter(
      (e) => e.merchantId === merchantId
    );
  }

  static getMetrics(merchantId?: string): {
    totalDecisions: number;
    exploitCount: number;
    exploreCount: number;
    explorationRate: number;
    averageExpectedReward: number;
    totalActualReward: number;
    actionDistribution: Record<string, number>;
    policySuppressions: number;
  } {
    const records = merchantId
      ? this.getMerchantDecisions(merchantId)
      : Array.from(this.inMemoryLedger.values());

    const total = records.length;
    if (total === 0) {
      return {
        totalDecisions: 0,
        exploitCount: 0,
        exploreCount: 0,
        explorationRate: 0,
        averageExpectedReward: 0,
        totalActualReward: 0,
        actionDistribution: {},
        policySuppressions: 0,
      };
    }

    let exploitCount = 0;
    let exploreCount = 0;
    let expRewardSum = 0;
    let actRewardSum = 0;
    let policySuppressions = 0;
    const actionDist: Record<string, number> = {};

    for (const r of records) {
      if (r.selectionMode === 'EXPLOIT') exploitCount++;
      if (r.selectionMode === 'EXPLORE') exploreCount++;
      expRewardSum += r.expectedReward;
      if (r.actualReward !== undefined) actRewardSum += r.actualReward;
      if (r.policyDecision === 'BLOCK_SUPPRESS') policySuppressions++;

      actionDist[r.selectedAction] = (actionDist[r.selectedAction] || 0) + 1;
    }

    return {
      totalDecisions: total,
      exploitCount,
      exploreCount,
      explorationRate: Math.round((exploreCount / total) * 1000) / 1000,
      averageExpectedReward: Math.round((expRewardSum / total) * 100) / 100,
      totalActualReward: Math.round(actRewardSum * 100) / 100,
      actionDistribution: actionDist,
      policySuppressions,
    };
  }

  static clear(): void {
    this.inMemoryLedger.clear();
  }
}
