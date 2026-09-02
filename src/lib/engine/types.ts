export type PaymentMethod = 'UPI' | 'CARD' | 'NETBANKING' | 'MANDATE' | 'WALLET';

export type PaymentStatus = 
  | 'FAILED'
  | 'RECOVERED'
  | 'RECOVERING'
  | 'NEEDS_APPROVAL'
  | 'SUPPRESSED'
  | 'ABANDONED'
  | 'SUCCESS';

export type FailureCategory = 
  | 'TECHNICAL'
  | 'INSUFFICIENT_FUNDS'
  | 'AUTHENTICATION'
  | 'EXPIRED_OR_INVALID'
  | 'RISK_AND_FRAUD'
  | 'CUSTOMER_DROPOUT'
  | 'MANDATE_ISSUE';

export type RecoveryActionType =
  | 'IMMEDIATE_RETRY'
  | 'OPTIMAL_DELAYED_RETRY'
  | 'WHATSAPP_NUDGE'
  | 'PAYMENT_LINK'
  | 'MANDATE_UPDATE'
  | 'HUMAN_ESCALATION'
  | 'DO_NOT_RECOVER';

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  segment: 'ENTERPRISE' | 'SMB' | 'CONSUMER' | 'VIP';
  lifetimeValue: number;
  totalTransactions: number;
  pastRecoveries: number;
  fatigueScore: number; // 0 to 100
  riskScore: number; // 0 to 100
  upiVpa?: string;
  cardLast4?: string;
  cardBrand?: 'VISA' | 'MASTERCARD' | 'RUPAY' | 'AMEX';
  bankName?: string;
}

export interface EVBreakdown {
  expectedValue: number; // in INR ₹
  successProbability: number; // 0.0 to 1.0
  grossPotential: number; // Amount * Probability
  interventionCost: number; // Gateway/SMS/WhatsApp fees in ₹
  fatiguePenaltyCost: number; // Customer churn/relationship risk discount in ₹
  netEV: number;
  confidenceScore: number; // 0 to 100
}

export interface StrategyYield {
  actionType: RecoveryActionType;
  actionTitle: string;
  successProbability: number;
  expectedValue: number;
  interventionCost: number;
  timeToRecoverHours: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  isRecommended: boolean;
  whyNotReason?: string;
}

export interface DecisionTraceStep {
  step: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  name: 'DETECT' | 'DIAGNOSE' | 'PREDICT' | 'SIMULATE' | 'OPTIMIZE' | 'APPROVE' | 'EXECUTE' | 'MEASURE';
  timestamp: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'AWAITING_APPROVAL' | 'SKIPPED' | 'FAILED';
  summary: string;
  details: Record<string, any>;
}

export interface Transaction {
  id: string;
  merchantId: string;
  merchantName: string;
  orderId: string;
  paymentId?: string;
  amount: number; // in INR
  currency: 'INR';
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
  
  // Failure details
  failureCode: string;
  failureMessage: string;
  failureCategory: FailureCategory;
  rawGatewayResponse?: Record<string, any>;
  
  // Customer
  customer: CustomerProfile;
  
  // AI & Recovery Intelligence
  recoveryProbability: number; // 0.00 to 1.00
  expectedRecoveryValue: number; // in INR
  recommendedAction: RecoveryActionType;
  actionConfidence: number; // 0 to 100
  aiRationale: string;
  whyNotRationale?: string;
  
  // Strategy Simulation & EV
  evBreakdown: EVBreakdown;
  strategyYields: StrategyYield[];
  
  // Policy & Approval
  requiresApproval: boolean;
  approvalReason?: string;
  approvedBy?: string;
  approvedAt?: string;
  
  // Execution & Trace
  executionChannel?: string;
  executionStatus?: 'PENDING' | 'DISPATCHED' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED';
  recoveredAt?: string;
  recoveredAmount?: number;
  decisionTrace: DecisionTraceStep[];
}

export interface PolicyGuardrails {
  id: string;
  autoApproveMaxAmount: number; // e.g., ₹10,000
  minConfidenceForAutoApprove: number; // e.g., 80%
  maxCustomerFatigueThreshold: number; // e.g., 70
  maxRetriesPerCustomerPerWeek: number; // e.g., 3
  disputeRiskBlockThreshold: number; // e.g., 65
  allowAutomatedWhatsAppNudges: boolean;
  allowAutomatedPaymentLinks: boolean;
  humanApprovalForVIPs: boolean;
  nightHoursRetrySilence: boolean; // Do not contact between 10 PM - 8 AM
}

export interface SimulatorParams {
  monthlyFailedVolumeINR: number; // e.g. ₹5,00,000
  avgTicketSizeINR: number; // e.g. ₹3,500
  primaryMethodShare: {
    upi: number; // e.g. 55%
    cards: number; // 30%
    netbanking: number; // 10%
    mandates: number; // 5%
  };
  retryDelayHours: number; // e.g. 6
  whatsAppEnabled: boolean;
  whatsAppCostINR: number; // e.g. ₹1.5
  paymentLinkEnabled: boolean;
  fatiguePenaltyWeight: number; // 1.0x
  aiOptimizationMode: 'MAX_REVENUE' | 'BALANCED' | 'MIN_FATIGUE';
}

export interface SimulatorResult {
  strategy: string;
  strategyKey: RecoveryActionType | 'AI_OPTIMIZED' | 'BASELINE';
  recoveredRevenueINR: number;
  recoveryRatePercent: number;
  totalInterventionCostINR: number;
  netRecoveredINR: number;
  roiMultiplier: number;
  customerFatigueIncidents: number;
  avoidedLossesINR: number;
  description: string;
}

export interface ExperimentArm {
  id: string;
  name: string;
  actionType: RecoveryActionType | 'AI_DYNAMIC';
  trafficAllocationPercent: number; // e.g., 50%
  sampleSize: number;
  recoveredCount: number;
  recoveredRevenueINR: number;
  recoveryRatePercent: number;
  totalInterventionCostINR: number;
  netRecoveredINR: number;
  averageTimeToRecoverMinutes: number;
  statisticalConfidence: number; // e.g. 98.4%
  isWinner?: boolean;
}

export interface RecoveryExperiment {
  id: string;
  title: string;
  hypothesis: string;
  status: 'RUNNING' | 'CONCLUDED' | 'DRAFT';
  startDate: string;
  endDate?: string;
  totalTraffic: number;
  controlArm: ExperimentArm;
  variantArms: ExperimentArm[];
  winningArmId?: string;
  insights: string[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorType: 'AI_AGENT' | 'MERCHANT_ADMIN' | 'POLICY_ENGINE' | 'GATEWAY_WEBHOOK' | 'SYSTEM';
  actorName: string;
  action: string;
  entityType: 'TRANSACTION' | 'POLICY' | 'SIMULATION' | 'EXPERIMENT' | 'PAYMENT_LINK';
  entityId: string;
  details: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
  integrityHash: string;
}

export interface MerchantOverview {
  id: string;
  name: string;
  businessType: 'SAAS' | 'D2C_ECOMMERCE' | 'EDTECH_SUBSCRIPTION' | 'FINTECH_NBFC';
  currency: string;
  totalRevenueINR: number;
  revenueAtRiskINR: number;
  potentialRecoveryINR: number;
  recoveredRevenueINR: number;
  recoveryRatePercent: number;
  avoidedLossINR: number;
  activeOpportunitiesCount: number;
  pendingApprovalCount: number;
}
