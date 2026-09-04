import {
  BanditDecisionRequest,
  BanditOutcomeRequest,
  ContextVectorInput,
  UnifiedBanditPlan,
} from './bandit-types';
import { BanditClient, defaultBanditClient } from './bandit-client';
import { BanditLedger } from './bandit-ledger';
import { ControlledActivationService } from '../activation/controlled-activation-service';
import { RolloutTier } from '../activation/activation-types';
import { MLHealthReport } from '../observability/observability-types';
import { CustomerProfile, FailureCategory, PaymentMethod, RecoveryActionType } from '../../engine/types';
import { evaluatePolicyGuardrails } from '../../engine/policy-guardrails';
import { evaluateRecoveryStrategies } from '../../engine/strategy-recommender';
import { RecoveryStrategyClass } from '../models/model-types';

export interface BanditOrchestrationInput {
  transactionId: string;
  merchantId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  failureCategory: FailureCategory;
  failureCode: string;
  customerProfile: CustomerProfile;
  configuredRolloutTier?: RolloutTier;
  healthReport: MLHealthReport;
  shadowMode?: boolean;
  phase6MLPlan?: {
    strategy: RecoveryStrategyClass;
    recoveryProbability: number;
    optimalDelayMinutes: number;
    expectedNetRecovery: number;
    confidence: number;
  };
}

export class BanditService {
  private client: BanditClient;

  constructor(client: BanditClient = defaultBanditClient) {
    this.client = client;
  }

  /**
   * Evaluates the transaction through Contextual Bandit, Safety Gates, and Policy Engine.
   * Guarantees ZERO payment disruption if Python service is unavailable.
   */
  async decide(input: BanditOrchestrationInput): Promise<UnifiedBanditPlan> {
    const {
      transactionId,
      merchantId = 'default_merchant',
      amount,
      paymentMethod,
      failureCategory,
      failureCode,
      customerProfile,
      configuredRolloutTier = 'FULL_100',
      healthReport,
      shadowMode = false,
      phase6MLPlan,
    } = input;

    // 1. Build Decision-Time Context Vector (Anti-Leakage Certified)
    const context: ContextVectorInput = {
      amount,
      payment_method: paymentMethod,
      failure_category: failureCategory,
      failure_code: failureCode,
      hour: new Date().getHours(),
      day_of_week: new Date().getDay(),
      time_since_last_payment_minutes: 30,
      customer_transaction_count: customerProfile.totalTransactions,
      customer_success_rate: 0.85,
      customer_recovery_rate: customerProfile.totalTransactions > 0
        ? customerProfile.pastRecoveries / customerProfile.totalTransactions
        : 0.5,
      upi_success_rate: 0.88,
      card_success_rate: 0.82,
      avg_recovery_delay_minutes: 15,
      previous_retry_count: 0,
      previous_recovery_count: customerProfile.pastRecoveries,
      fatigue_score: customerProfile.fatigueScore,
      risk_score: customerProfile.riskScore,
      merchant_recovery_rate: 0.72,
      phase6_2_recovery_probability: phase6MLPlan?.recoveryProbability ?? 0.5,
      phase6_3_strategy_probabilities: {
        IMMEDIATE_RETRY: 0.2,
        OPTIMAL_DELAYED_RETRY: 0.4,
        PAYMENT_LINK: 0.3,
        WHATSAPP_NUDGE: 0.1,
      },
    };

    // 2. Query Python Bandit Service
    const candidateActions: string[] = [
      'IMMEDIATE_RETRY',
      'OPTIMAL_DELAYED_RETRY',
      'PAYMENT_LINK',
      'WHATSAPP_NUDGE',
      'MANDATE_UPDATE',
      'HUMAN_ESCALATION',
    ];
    if (amount < 200 || customerProfile.riskScore > 50 || customerProfile.fatigueScore > 65) {
      candidateActions.push('DO_NOT_RECOVER');
    }

    const banditRequest: BanditDecisionRequest = {
      merchant_id: merchantId,
      transaction_id: transactionId,
      context,
      candidate_actions: candidateActions,
      model_version: 'bandit-v1.0',
    };

    const banditResponse = await this.client.decide(banditRequest);
    const isPythonAvailable = banditResponse !== null;

    // 3. Fallback Heuristic Baseline (Phase 3)
    const heuristic = evaluateRecoveryStrategies(
      amount,
      failureCategory,
      failureCode,
      paymentMethod,
      customerProfile
    );

    // 4. If Bandit responded, evaluate proposal through Phase 6.6 Safety Architecture
    if (banditResponse) {
      const mlProposal = {
        strategy: banditResponse.selected_action,
        recoveryProbability: phase6MLPlan?.recoveryProbability ?? 0.75,
        optimalDelayMinutes: phase6MLPlan?.optimalDelayMinutes ?? 20,
        expectedNetRecovery: banditResponse.expected_reward > 0 ? banditResponse.expected_reward : heuristic.expectedRecoveryValue,
        confidence: 0.80,
      };

      const activationDecision = ControlledActivationService.decide({
        transactionId,
        merchantId,
        amount,
        paymentMethod,
        failureCategory,
        failureCode,
        customerProfile,
        configuredRolloutTier,
        healthReport,
        mlPlan: mlProposal,
      });

      // Audit Log in Bandit Ledger
      await BanditLedger.recordDecision({
        decisionId: `bandit_dec_${transactionId}`,
        merchantId,
        transactionId,
        context,
        candidateActions: banditRequest.candidate_actions!,
        decision: banditResponse,
        policyDecision: activationDecision.policyAuthorization?.status,
        policyReason: activationDecision.policyAuthorization?.blockReason,
      });

      const isBanditGoverning = !shadowMode && activationDecision.decisionSource === 'ML';
      const isPolicySuppressed = activationDecision.decisionSource === 'POLICY_SUPPRESSION';
      const disagreement = banditResponse.selected_action !== heuristic.recommendedAction;

      let finalDecisionSource: UnifiedBanditPlan['decisionSource'];
      let activeStrategy = activationDecision.selectedStrategy;
      let activeDelay = activationDecision.optimalDelayMinutes;
      let activeEV = activationDecision.expectedNetRecovery;

      if (isPolicySuppressed) {
        finalDecisionSource = 'POLICY_SUPPRESSION';
        activeStrategy = 'DO_NOT_RECOVER';
      } else if (shadowMode) {
        finalDecisionSource = 'BANDIT_SHADOW';
        activeStrategy = heuristic.recommendedAction as RecoveryStrategyClass;
        activeDelay = 15;
        activeEV = heuristic.expectedRecoveryValue;
      } else if (isBanditGoverning) {
        finalDecisionSource = 'BANDIT';
      } else {
        finalDecisionSource = 'CONTROLLED_ML_FALLBACK';
      }

      return {
        transactionId,
        merchantId,
        decisionSource: finalDecisionSource,
        selectedStrategy: activeStrategy,
        selectionMode: isBanditGoverning || shadowMode ? banditResponse.selection_mode : 'NONE',
        optimalDelayMinutes: activeDelay,
        expectedNetRecovery: activeEV,
        confidence: activationDecision.confidence,
        explorationProbability: banditResponse.exploration_probability,
        rolloutTier: configuredRolloutTier,
        isInCanaryBucket: activationDecision.isInCanaryBucket,
        isPythonServiceAvailable: true,
        isShadowOnly: shadowMode,
        disagreementWithBaseline: disagreement,
        heuristicBaselineStrategy: heuristic.recommendedAction as RecoveryStrategyClass,
        gateReport: activationDecision.gateReport,
        policyAuthorization: activationDecision.policyAuthorization,
        rationale: shadowMode
          ? `[SHADOW MODE] Bandit proposes ${banditResponse.selected_action} (exp reward: ₹${banditResponse.expected_reward}) vs Baseline ${heuristic.recommendedAction}. Baseline executes.`
          : (isBanditGoverning
              ? `Contextual Bandit (${banditResponse.selection_mode}): ${banditResponse.explanation}`
              : activationDecision.rationale),
        generatedAt: new Date().toISOString(),
      };
    }

    // 5. Python Service Unavailable -> Seamless Heuristic Fallback (Zero Payment Disruption)
    const policyAuthorization = evaluatePolicyGuardrails(
      amount,
      heuristic.recommendedAction as RecoveryActionType,
      heuristic.actionConfidence,
      customerProfile
    );

    const isSuppressed = policyAuthorization.status === 'BLOCK_SUPPRESS';

    return {
      transactionId,
      merchantId,
      decisionSource: isSuppressed ? 'POLICY_SUPPRESSION' : 'HEURISTIC_FALLBACK',
      selectedStrategy: isSuppressed ? 'DO_NOT_RECOVER' : (heuristic.recommendedAction as RecoveryStrategyClass),
      selectionMode: 'NONE',
      optimalDelayMinutes: 15,
      expectedNetRecovery: heuristic.expectedRecoveryValue,
      confidence: heuristic.actionConfidence,
      explorationProbability: 0,
      rolloutTier: configuredRolloutTier,
      isInCanaryBucket: false,
      isPythonServiceAvailable: false,
      policyAuthorization,
      rationale: isSuppressed
        ? `Policy Engine suppressed execution: ${policyAuthorization.blockReason}`
        : 'Python Bandit service offline. Seamless fallback to Phase 3 Heuristic Intelligence. Zero payment disruption.',
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Reports real-world payment outcome to update Bandit posterior model.
   */
  async reportOutcome(request: BanditOutcomeRequest) {
    // 1. Update Ledger
    await BanditLedger.recordOutcome({
      decisionId: request.bandit_decision_id,
      actualReward: request.recovered_amount - request.recovery_cost - request.experience_penalty - request.risk_penalty,
      outcome: request.outcome,
      recoveredAmount: request.recovered_amount,
    });

    // 2. Transmit to Python Service
    return await this.client.recordOutcome(request);
  }
}

export const defaultBanditService = new BanditService();
