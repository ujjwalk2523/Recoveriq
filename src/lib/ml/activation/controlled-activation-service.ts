import {
  ActivationDecision,
  GateEvaluationReport,
  RolloutTier,
  ROLLOUT_TIER_PERCENTAGES,
} from './activation-types';
import { TrafficRouter } from './traffic-router';
import { MLSafetyGates } from './ml-safety-gates';
import { RollbackManager } from './rollback-manager';
import { MLHealthReport } from '../observability/observability-types';
import { FeatureRecord } from '../feature-types';
import { RecoveryStrategyClass } from '../models/model-types';
import { evaluateRecoveryStrategies } from '../../engine/strategy-recommender';
import { evaluatePolicyGuardrails, PolicyCheckResult } from '../../engine/policy-guardrails';
import { CustomerProfile, FailureCategory, PaymentMethod, RecoveryActionType } from '../../engine/types';

export interface ControlledActivationInput {
  transactionId: string;
  merchantId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  failureCategory: FailureCategory;
  failureCode: string;
  customerProfile: CustomerProfile;
  configuredRolloutTier?: RolloutTier;
  healthReport: MLHealthReport;
  // Pre-calculated ML recommendations (from Phases 6.2, 6.3, 6.4)
  mlPlan?: {
    strategy: RecoveryStrategyClass;
    recoveryProbability: number;
    optimalDelayMinutes: number;
    expectedNetRecovery: number;
    confidence: number;
  };
}

export class ControlledActivationService {
  /**
   * Evaluates safety gates, canary traffic split, and circuit breaker
   * to determine whether ML or Heuristic Engine governs the transaction
   */
  static decide(input: ControlledActivationInput): ActivationDecision {
    const {
      transactionId,
      merchantId = 'default_merchant',
      amount,
      paymentMethod,
      failureCategory,
      failureCode,
      customerProfile,
      healthReport,
      mlPlan,
    } = input;

    const configuredTier = input.configuredRolloutTier ?? 'SHADOW_0';

    // 1. Check Circuit Breaker & Automatic Rollback status
    RollbackManager.evaluateHealthAndAutoRollback(healthReport);
    const { effectiveTier, isCircuitBreakerOpen } =
      RollbackManager.getEffectiveRollout(configuredTier);

    const trafficPercentage = ROLLOUT_TIER_PERCENTAGES[effectiveTier];

    // 2. Evaluate Canary Traffic Routing
    const canaryCheck = TrafficRouter.isAssignedToCanary({
      transactionId,
      merchantId,
      rolloutTier: effectiveTier,
    });

    // 3. Fallback Heuristic Calculation (Phase 3 Baseline)
    const heuristicRecommendation = evaluateRecoveryStrategies(
      amount,
      failureCategory,
      failureCode,
      paymentMethod,
      customerProfile
    );

    const heuristicStrategy = heuristicRecommendation.recommendedAction as RecoveryStrategyClass;
    const heuristicEV = heuristicRecommendation.expectedRecoveryValue;
    const heuristicProb = heuristicRecommendation.recoveryProbability;
    const heuristicDelayMinutes = 15; // Standard heuristic baseline delay

    // 4. Evaluate Safety Gates
    const confidence = mlPlan?.confidence ?? 0.50;
    const gateReport = MLSafetyGates.evaluateGates({
      healthReport,
      confidence,
      fatigueScore: customerProfile.fatigueScore,
      riskScore: customerProfile.riskScore,
      failureCategory,
    });

    // 5. Determine Decision Authority (ML vs Heuristic Fallback)
    const canMLGovern =
      !isCircuitBreakerOpen &&
      gateReport.allGatesPassed &&
      canaryCheck.isAssigned &&
      mlPlan !== undefined;

    let decisionSource: ActivationDecision['decisionSource'];
    let selectedStrategy: RecoveryStrategyClass;
    let optimalDelayMinutes: number;
    let expectedNetRecovery: number;
    let recoveryProbability: number;
    let finalConfidence: number;
    let rationale: string;

    if (canMLGovern) {
      decisionSource = 'ML';
      selectedStrategy = mlPlan.strategy;
      optimalDelayMinutes = mlPlan.optimalDelayMinutes;
      expectedNetRecovery = mlPlan.expectedNetRecovery;
      recoveryProbability = mlPlan.recoveryProbability;
      finalConfidence = mlPlan.confidence;
      rationale = `ML Active Decisioning authorized (${effectiveTier} Canary bucket #${canaryCheck.bucket}). All 5 safety gates passed.`;
    } else {
      decisionSource = 'HEURISTIC_FALLBACK';
      selectedStrategy = heuristicStrategy;
      optimalDelayMinutes = heuristicDelayMinutes;
      expectedNetRecovery = heuristicEV;
      recoveryProbability = heuristicProb;
      finalConfidence = heuristicRecommendation.actionConfidence;

      if (isCircuitBreakerOpen) {
        rationale = `Circuit Breaker OPEN. Reverted to Phase 3 Heuristics (${RollbackManager.getTripReason()}). Zero payment disruption.`;
      } else if (!canaryCheck.isAssigned) {
        rationale = `Transaction bucket #${canaryCheck.bucket} outside active canary tier (${effectiveTier}, ${trafficPercentage}%). Routed to Phase 3 Heuristics.`;
      } else {
        rationale = `ML safety gates failed (${gateReport.failureReasons.join('; ')}). Safely fell back to Phase 3 Heuristics.`;
      }
    }

    // 6. Policy Engine Governance & Guardrails
    const policyAuthorization = evaluatePolicyGuardrails(
      amount,
      selectedStrategy as RecoveryActionType,
      finalConfidence,
      customerProfile
    );

    // If Policy Engine suppresses the action, mark decision source
    if (policyAuthorization.status === 'BLOCK_SUPPRESS' || policyAuthorization.isBlockedByPolicy) {
      decisionSource = 'POLICY_SUPPRESSION';
      selectedStrategy = 'DO_NOT_RECOVER';
      rationale = `Policy Engine suppressed execution: ${policyAuthorization.blockReason || 'Hard block'}`;
    }

    return {
      transactionId,
      merchantId,
      decisionSource,
      selectedStrategy,
      optimalDelayMinutes,
      expectedNetRecovery,
      recoveryProbability,
      confidence: finalConfidence,
      rolloutTier: configuredTier,
      trafficPercentage,
      isInCanaryBucket: canaryCheck.isAssigned,
      circuitBreakerStatus: RollbackManager.getStatus(),
      gateReport,
      policyAuthorization,
      rationale,
      generatedAt: new Date().toISOString(),
    };
  }
}
