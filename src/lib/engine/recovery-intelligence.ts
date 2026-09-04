import {
  CustomerProfile,
  DecisionTraceStep,
  FailureCategory,
  PaymentMethod,
  PolicyGuardrails,
  RecoveryActionType,
  StrategyYield,
} from './types';
import { FailureDiagnosis, diagnosePaymentFailure } from './classifier';
import { CustomerRecoveryMemory, computeCustomerRecoveryMemory } from './customer-profile';
import { RecoveryProbabilityService } from './probability-service';
import { FatigueEngine, FatigueEvaluationResult } from './fatigue-engine';
import { RiskEngine, RiskAssessment } from './risk-engine';
import { StrategyRecommendationResult, evaluateRecoveryStrategies } from './strategy-recommender';
import { PolicyCheckResult, evaluatePolicyGuardrails, DEFAULT_POLICY_GUARDRAILS } from './policy-guardrails';

export interface RecoveryIntelligenceInput {
  amount: number;
  paymentMethod: PaymentMethod;
  failureCode: string;
  failureMessage?: string;
  customer: CustomerProfile;
  policies?: PolicyGuardrails;
  attemptNumber?: number;
  hourOfDay?: number;
}

export interface RecoveryIntelligenceResult {
  // 1. Failure Diagnosis
  diagnosis: FailureDiagnosis;

  // 2. Customer Memory
  customerMemory: CustomerRecoveryMemory;

  // 3. Strategy & Net EV
  recommendation: StrategyRecommendationResult;
  recommendedAction: RecoveryActionType;
  expectedNetRecoveryINR: number;
  recoveryProbability: number;
  confidenceScore: number;
  strategyYields: StrategyYield[];

  // 4. Fatigue Analysis
  fatigueAnalysis: FatigueEvaluationResult;

  // 5. Risk Assessment
  riskAssessment: RiskAssessment;

  // 6. Policy Authorization
  policyCheck: PolicyCheckResult;
  isAutoApproved: boolean;
  approvalReason?: string;

  // 7. Explainable Diagnostics (Traces 1 to 8)
  decisionTraces: DecisionTraceStep[];
  aiRationale: string;
  whyNotRationale?: string;
}

export class RecoveryIntelligenceEngine {
  /**
   * Orchestrates the complete 8-stage Recovery Intelligence Pipeline
   */
  static process(input: RecoveryIntelligenceInput): RecoveryIntelligenceResult {
    const {
      amount,
      paymentMethod,
      failureCode,
      failureMessage,
      customer,
      policies = DEFAULT_POLICY_GUARDRAILS,
      attemptNumber = 1,
      hourOfDay = new Date().getHours(),
    } = input;

    const now = new Date().toISOString();

    // -------------------------------------------------------------------------
    // Stage 1: Failure Diagnosis
    // -------------------------------------------------------------------------
    const diagnosis = diagnosePaymentFailure(failureCode, paymentMethod, failureMessage);

    // -------------------------------------------------------------------------
    // Stage 2: Customer Recovery Memory
    // -------------------------------------------------------------------------
    const customerMemory = computeCustomerRecoveryMemory([], {
      fatigueScore: customer.fatigueScore,
      riskScore: customer.riskScore,
      pastRecoveries: customer.pastRecoveries,
      totalTransactions: customer.totalTransactions,
    });

    // -------------------------------------------------------------------------
    // Stage 3 & 4: Multi-Strategy Scoring & Expected Net Recovery
    // -------------------------------------------------------------------------
    const recommendation = evaluateRecoveryStrategies(
      amount,
      diagnosis.category,
      failureCode,
      paymentMethod,
      customer,
      attemptNumber,
      hourOfDay
    );

    const recommendedAction = recommendation.recommendedAction;

    // -------------------------------------------------------------------------
    // Stage 5: Fatigue Engine Analysis
    // -------------------------------------------------------------------------
    const fatigueAnalysis = FatigueEngine.evaluate({
      currentFatigueScore: customer.fatigueScore,
      actionType: recommendedAction,
      attemptNumber,
      customerLTV: customer.lifetimeValue,
      maxFatigueThreshold: policies.maxCustomerFatigueThreshold,
    });

    // -------------------------------------------------------------------------
    // Stage 6: Risk Engine Assessment
    // -------------------------------------------------------------------------
    const riskAssessment = RiskEngine.evaluate({
      amount,
      failureCategory: diagnosis.category,
      failureCode,
      severity: diagnosis.severity,
      customerRiskScore: customer.riskScore,
      confidenceScore: recommendation.actionConfidence,
      actionType: recommendedAction,
      disputeRiskThreshold: policies.disputeRiskBlockThreshold,
    });

    // -------------------------------------------------------------------------
    // Stage 7: Policy Guardrails Authorization (AI recommends, Policy authorizes)
    // -------------------------------------------------------------------------
    const policyCheck = evaluatePolicyGuardrails(
      amount,
      recommendedAction,
      recommendation.actionConfidence,
      customer,
      policies,
      hourOfDay
    );

    const isAutoApproved = policyCheck.status === 'AUTO_APPROVED';
    const approvalReason = policyCheck.isBlockedByPolicy
      ? policyCheck.blockReason
      : policyCheck.approvalReasons.length > 0
      ? policyCheck.approvalReasons.join('; ')
      : undefined;

    // -------------------------------------------------------------------------
    // Stage 8: Generate Explainable 8-Step Decision Traces
    // -------------------------------------------------------------------------
    const traces: DecisionTraceStep[] = [
      {
        step: 1,
        name: 'DETECT',
        timestamp: now,
        status: 'COMPLETED',
        summary: `Captured gateway failure event: ${failureCode} (${paymentMethod})`,
        details: { failureCode, paymentMethod, amount, hourOfDay },
      },
      {
        step: 2,
        name: 'DIAGNOSE',
        timestamp: now,
        status: 'COMPLETED',
        summary: `Classified as ${diagnosis.category} [Severity: ${diagnosis.severity}, Recoverability: ${diagnosis.recoverability}]`,
        details: {
          category: diagnosis.category,
          severity: diagnosis.severity,
          recoverability: diagnosis.recoverability,
          recommendedChannels: diagnosis.recommendedChannels,
          avoidChannels: diagnosis.avoidChannels,
          reasoning: diagnosis.reasoning,
        },
      },
      {
        step: 3,
        name: 'PREDICT',
        timestamp: now,
        status: 'COMPLETED',
        summary: `Calculated recovery probability: ${Math.round(recommendation.recoveryProbability * 100)}% (Customer recovery memory: ${customerMemory.recoveryRate}%)`,
        details: {
          probability: recommendation.recoveryProbability,
          customerMemory,
          model: 'RecoverIQ-ProbabilityEngine-v3.1-HeuristicBandit',
        },
      },
      {
        step: 4,
        name: 'SIMULATE',
        timestamp: now,
        status: 'COMPLETED',
        summary: `Net EV: ₹${recommendation.expectedRecoveryValue.toLocaleString('en-IN')} (Gross: ₹${recommendation.expectedNetRecoveryBreakdown.grossPotential.toLocaleString('en-IN')}, Cost: ₹${recommendation.expectedNetRecoveryBreakdown.interventionCost}, Fatigue: ₹${recommendation.expectedNetRecoveryBreakdown.fatiguePenalty})`,
        details: recommendation.expectedNetRecoveryBreakdown,
      },
      {
        step: 5,
        name: 'OPTIMIZE',
        timestamp: now,
        status: 'COMPLETED',
        summary: `Ranked 7 candidate strategies. Selected optimal action: ${recommendedAction} (Confidence: ${recommendation.actionConfidence}%)`,
        details: {
          recommendedAction,
          confidence: recommendation.actionConfidence,
          yieldsTable: recommendation.strategyYields.map(y => ({
            action: y.actionType,
            probability: `${Math.round(y.successProbability * 100)}%`,
            netEV: `₹${y.expectedValue.toLocaleString('en-IN')}`,
            isRecommended: y.isRecommended,
          })),
        },
      },
      {
        step: 6,
        name: 'APPROVE',
        timestamp: now,
        status: isAutoApproved ? 'COMPLETED' : 'AWAITING_APPROVAL',
        summary: isAutoApproved
          ? 'Auto-approved by Policy Guardrails (cleared auto-ceiling & quiet hours)'
          : `Requires manual sign-off: ${approvalReason || 'Manual sign-off required'}`,
        details: {
          status: policyCheck.status,
          requiresHumanApproval: policyCheck.requiresHumanApproval,
          reasons: policyCheck.approvalReasons,
          passed: policyCheck.passedPolicies,
        },
      },
      {
        step: 7,
        name: 'EXECUTE',
        timestamp: now,
        status: isAutoApproved ? 'IN_PROGRESS' : 'AWAITING_APPROVAL',
        summary: isAutoApproved
          ? `Dispatched recovery action via ${recommendedAction}`
          : 'Execution pending operator authorization',
        details: { channel: recommendedAction, attemptNumber },
      },
      {
        step: 8,
        name: 'MEASURE',
        timestamp: now,
        status: 'IN_PROGRESS',
        summary: 'Awaiting settlement callback from gateway / webhook',
        details: { attemptNumber, dispatchedAt: now },
      },
    ];

    return {
      diagnosis,
      customerMemory,
      recommendation,
      recommendedAction,
      expectedNetRecoveryINR: recommendation.expectedRecoveryValue,
      recoveryProbability: recommendation.recoveryProbability,
      confidenceScore: recommendation.actionConfidence,
      strategyYields: recommendation.strategyYields,
      fatigueAnalysis,
      riskAssessment,
      policyCheck,
      isAutoApproved,
      approvalReason,
      decisionTraces: traces,
      aiRationale: recommendation.aiRationale,
      whyNotRationale: recommendation.whyNotRationale,
    };
  }
}
