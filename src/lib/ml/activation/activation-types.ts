import { RecoveryStrategyClass } from '../models/model-types';
import { TimeBucket } from '../timing/timing-types';
import { MLHealthReport } from '../observability/observability-types';
import { PolicyCheckResult } from '../../engine/policy-guardrails';

export type RolloutTier =
  | 'SHADOW_0'      // 0% ML traffic (Shadow Mode only)
  | 'CANARY_5'      // 5% ML traffic
  | 'LIMITED_10'    // 10% ML traffic
  | 'CONTROLLED_25' // 25% ML traffic
  | 'EXPANDED_50'   // 50% ML traffic
  | 'FULL_100';     // 100% ML traffic

export const ROLLOUT_TIER_PERCENTAGES: Record<RolloutTier, number> = {
  SHADOW_0: 0,
  CANARY_5: 5,
  LIMITED_10: 10,
  CONTROLLED_25: 25,
  EXPANDED_50: 50,
  FULL_100: 100,
};

export type CircuitBreakerStatus = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface GateCheckResult {
  gateName: string;
  passed: boolean;
  scoreOrValue: number | string;
  threshold: number | string;
  failureReason?: string;
}

export interface GateEvaluationReport {
  allGatesPassed: boolean;
  gates: {
    healthGate: GateCheckResult;
    calibrationGate: GateCheckResult;
    confidenceGate: GateCheckResult;
    driftGate: GateCheckResult;
    policyGate: GateCheckResult;
  };
  failureReasons: string[];
}

export type ActivationDecisionSource = 'ML' | 'HEURISTIC_FALLBACK' | 'POLICY_SUPPRESSION';

export interface ActivationDecision {
  transactionId: string;
  merchantId: string;
  decisionSource: ActivationDecisionSource;
  selectedStrategy: RecoveryStrategyClass;
  optimalDelayMinutes: number;
  expectedNetRecovery: number;
  recoveryProbability: number;
  confidence: number;
  rolloutTier: RolloutTier;
  trafficPercentage: number;
  isInCanaryBucket: boolean;
  circuitBreakerStatus: CircuitBreakerStatus;
  gateReport: GateEvaluationReport;
  policyAuthorization?: PolicyCheckResult;
  rationale: string;
  generatedAt: string;
}
