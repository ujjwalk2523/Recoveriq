/**
 * Phase 6.8 Self-Improving Recovery Engine Types
 */

export type EvidenceTier = 'LOW' | 'MEDIUM' | 'HIGH';

export type LearningStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'ALREADY_PROCESSED';

export type LearningOutcomeType =
  | 'RECOVERY_SUCCEEDED'
  | 'RECOVERY_FAILED'
  | 'RECOVERY_EXPIRED'
  | 'RECOVERY_SUPPRESSED'
  | 'RECOVERY_CANCELLED'
  | 'RECOVERY_APPROVAL_REJECTED'
  | 'RECOVERY_APPROVAL_ACCEPTED'
  | 'RECOVERY_TIMEOUT';

export type CustomerBehavioralSegment =
  | 'NEW_CUSTOMER'
  | 'REPEAT_CUSTOMER'
  | 'HIGH_VALUE_CUSTOMER'
  | 'HIGH_RECOVERY_PROPENSITY'
  | 'LOW_RECOVERY_PROPENSITY'
  | 'RETRY_TOLERANT'
  | 'RETRY_SENSITIVE'
  | 'LINK_RESPONSIVE'
  | 'WHATSAPP_RESPONSIVE'
  | 'NIGHTTIME_RECOVERY'
  | 'DAYTIME_RECOVERY'
  | 'HIGH_FATIGUE'
  | 'HIGH_RISK';

export interface RecoveryLearningEventPayload {
  merchantId: string;
  transactionId: string;
  customerId?: string;
  banditDecisionId?: string;
  strategy: string;
  timingBucket?: string;
  paymentMethod: string;
  failureCategory: string;
  failureCode?: string;
  amount: number;
  recoveredAmount: number;
  recoveryCost: number;
  fatiguePenalty: number;
  riskPenalty: number;
  reward: number;
  outcome: LearningOutcomeType;
  recoveryDelayMinutes?: number;
  dataSource?: 'SYNTHETIC' | 'RAZORPAY_TEST' | 'RAZORPAY_LIVE';
  modelVersion?: string;
  timestamp?: string;
}

export interface LearningResult {
  success: boolean;
  status: LearningStatus;
  learningEventId: string;
  isDuplicate?: boolean;
  customerMemoryUpdated: boolean;
  merchantIntelligenceUpdated: boolean;
  strategyMemoryUpdated: boolean;
  timingMemoryUpdated: boolean;
  failurePatternUpdated: boolean;
  banditPosteriorUpdated: boolean;
  anomaliesDetected: number;
  message?: string;
}

export interface StrategyPerformanceMetrics {
  strategy: string;
  attempts: number;
  successes: number;
  failures: number;
  recoveryRate: number; // Beta-binomial smoothed rate (0.0 - 1.0)
  rawSuccessRate: number;
  recoveredRevenue: number;
  recoveryCost: number;
  netRecoveryRevenue: number;
  averageReward: number;
  averageDelayMinutes: number;
  evidenceLevel: EvidenceTier;
  lastObservedAt: string;
}

export interface TimingBucketPerformanceMetrics {
  bucket: string; // IMMEDIATE_0M, SHORT_5_15M, MEDIUM_30_60M, LONG_2_4H
  attempts: number;
  successes: number;
  recoveryRate: number;
  averageReward: number;
  averageDelayMinutes: number;
  evidenceLevel: EvidenceTier;
  lastObservedAt: string;
}

export interface FailurePatternPerformanceMetrics {
  key: string; // category:rail:amountBand
  failureCategory: string;
  paymentMethod: string;
  amountBand: string;
  attempts: number;
  successes: number;
  recoveryRate: number;
  bestStrategy: string;
  averageReward: number;
  lastObservedAt: string;
}

export interface IntelligenceQualityBreakdown {
  score: number; // 0 - 100
  sampleSizeScore: number; // 0 - 30
  recencyScore: number; // 0 - 25
  strategyCoverageScore: number; // 0 - 25
  outcomeBalanceScore: number; // 0 - 20
  evidenceLevel: EvidenceTier;
  isColdStart: boolean;
  coldStartReason?: string;
}
