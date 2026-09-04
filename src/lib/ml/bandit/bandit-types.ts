import { RecoveryStrategyClass } from '../models/model-types';
import { PolicyCheckResult } from '../../engine/policy-guardrails';
import { GateEvaluationReport, RolloutTier } from '../activation/activation-types';

export interface ContextVectorInput {
  amount: number;
  payment_method: string;
  failure_category: string;
  failure_code: string;
  hour: number;
  day_of_week: number;
  time_since_last_payment_minutes: number;
  customer_transaction_count: number;
  customer_success_rate: number;
  customer_recovery_rate: number;
  upi_success_rate: number;
  card_success_rate: number;
  avg_recovery_delay_minutes: number;
  previous_retry_count: number;
  previous_recovery_count: number;
  fatigue_score: number;
  risk_score: number;
  merchant_recovery_rate: number;
  phase6_2_recovery_probability: number;
  phase6_3_strategy_probabilities?: Record<string, number>;
  phase6_4_timing_probabilities?: Record<string, number>;
}

export interface BanditDecisionRequest {
  merchant_id: string;
  transaction_id: string;
  context: ContextVectorInput;
  candidate_actions?: string[];
  model_version?: string;
  random_seed?: number;
}

export interface BanditDecisionResponse {
  transaction_id: string;
  merchant_id: string;
  merchant_scope?: string;
  selected_action: RecoveryStrategyClass;
  best_expected_action: RecoveryStrategyClass;
  selection_mode: 'EXPLOIT' | 'EXPLORE';
  exploration_mode?: 'EXPLOIT' | 'EXPLORE';
  action_scores: Record<string, number>;
  expected_reward: number;
  confidence?: number;
  exploration_probability: number;
  algorithm: string;
  model_version: string;
  explanation: string;
  generated_at: string;
}

export interface BanditOutcomeRequest {
  bandit_decision_id: string;
  decision_id?: string;
  idempotency_key?: string;
  merchant_id?: string;
  merchantId?: string;
  transaction_id?: string;
  transactionId?: string;
  selected_action: string;
  recovered_amount: number;
  recovered_revenue?: number;
  recovery_cost: number;
  experience_penalty: number;
  fatigue_penalty?: number;
  risk_penalty: number;
  reward?: number;
  outcome: 'RECOVERED' | 'FAILED' | 'EXPIRED' | 'CANCELLED' | 'SUPPRESSED' | 'HUMAN_APPROVED' | 'HUMAN_REJECTED';
  context_snapshot?: Record<string, any>;
}

export interface BanditOutcomeResponse {
  bandit_decision_id: string;
  decision_id?: string;
  idempotency_key?: string;
  status: string;
  raw_reward: number;
  normalized_reward: number;
  updated_action: string;
  total_action_observations: number;
  is_idempotent_duplicate: boolean;
  recorded_at: string;
}

export interface BanditHealthResponse {
  status: string;
  service_name: string;
  service_version: string;
  model_version: string;
  algorithm: string;
  active_action_count: number;
  global_total_observations: number;
  timestamp: string;
}

export interface BanditModelInfoResponse {
  model_version: string;
  algorithm: string;
  merchant_id: string;
  dimension: number;
  lambda_prior: number;
  exploration_variance: number;
  total_observations: number;
  actions: Record<string, {
    display_name: string;
    base_cost: number;
    contact_required: boolean;
    risk_level: string;
    observations_count: number;
  }>;
  timestamp: string;
}

export interface UnifiedBanditPlan {
  transactionId: string;
  merchantId: string;
  decisionSource: 'BANDIT' | 'BANDIT_SHADOW' | 'CONTROLLED_ML_FALLBACK' | 'HEURISTIC_FALLBACK' | 'POLICY_SUPPRESSION';
  selectedStrategy: RecoveryStrategyClass;
  selectionMode: 'EXPLOIT' | 'EXPLORE' | 'NONE';
  optimalDelayMinutes: number;
  expectedNetRecovery: number;
  confidence: number;
  explorationProbability: number;
  rolloutTier: RolloutTier;
  isInCanaryBucket: boolean;
  isPythonServiceAvailable: boolean;
  isShadowOnly?: boolean;
  disagreementWithBaseline?: boolean;
  heuristicBaselineStrategy?: RecoveryStrategyClass;
  gateReport?: GateEvaluationReport;
  policyAuthorization?: PolicyCheckResult;
  rationale: string;
  generatedAt: string;
}
