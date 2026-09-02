import {
  AuditLogEntry,
  CustomerProfile,
  DecisionTraceStep,
  FailureCategory,
  MerchantOverview,
  PaymentMethod,
  PaymentStatus,
  RecoveryActionType,
  RecoveryExperiment,
  Transaction,
} from '../engine/types';
import { classifyPaymentFailure } from '../engine/classifier';
import { evaluateRecoveryStrategies } from '../engine/strategy-recommender';
import { calculateExpectedRecoveryValue } from '../engine/ev-calculator';
import { evaluatePolicyGuardrails } from '../engine/policy-guardrails';

export const INITIAL_MERCHANT: MerchantOverview = {
  id: 'mer_saasify_blr',
  name: 'SaaSify Technologies India Pvt Ltd',
  businessType: 'SAAS',
  currency: 'INR',
  totalRevenueINR: 48520000, // ₹4.85 Crore
  revenueAtRiskINR: 3480000, // ₹34.8 Lakhs
  potentialRecoveryINR: 2685000, // ₹26.85 Lakhs
  recoveredRevenueINR: 1942000, // ₹19.42 Lakhs
  recoveryRatePercent: 72.4,
  avoidedLossINR: 412000, // ₹4.12 Lakhs avoided loss (fraud/dispute prevention)
  activeOpportunitiesCount: 24,
  pendingApprovalCount: 7,
};

const RAW_CUSTOMERS: CustomerProfile[] = [
  {
    id: 'cust_001',
    name: 'Vikramaditya Rao',
    email: 'vikram.rao@fintechnext.in',
    phone: '+91 98201 44521',
    segment: 'VIP',
    lifetimeValue: 245000,
    totalTransactions: 18,
    pastRecoveries: 3,
    fatigueScore: 28,
    riskScore: 12,
    upiVpa: 'vikramaditya@okhdfcbank',
    cardLast4: '4092',
    cardBrand: 'VISA',
    bankName: 'HDFC Bank',
  },
  {
    id: 'cust_002',
    name: 'Ananya Deshmukh',
    email: 'ananya.d@cloudscale.io',
    phone: '+91 97690 12890',
    segment: 'ENTERPRISE',
    lifetimeValue: 480000,
    totalTransactions: 24,
    pastRecoveries: 1,
    fatigueScore: 15,
    riskScore: 8,
    upiVpa: 'ananya@paytm',
    bankName: 'ICICI Bank',
  },
  {
    id: 'cust_003',
    name: 'Rahul Sharma',
    email: 'rahul.sharma@gmail.com',
    phone: '+91 99880 77665',
    segment: 'CONSUMER',
    lifetimeValue: 18500,
    totalTransactions: 6,
    pastRecoveries: 0,
    fatigueScore: 88, // HIGH FATIGUE -> SUPPRESSION
    riskScore: 22,
    upiVpa: 'rahulsharma@axl',
    cardLast4: '8812',
    cardBrand: 'MASTERCARD',
    bankName: 'Axis Bank',
  },
  {
    id: 'cust_004',
    name: 'Priya Nair',
    email: 'priya.nair@keralaedu.org',
    phone: '+91 94470 99881',
    segment: 'SMB',
    lifetimeValue: 64000,
    totalTransactions: 12,
    pastRecoveries: 2,
    fatigueScore: 42,
    riskScore: 14,
    upiVpa: 'priya.nair@sbi',
    bankName: 'State Bank of India',
  },
  {
    id: 'cust_005',
    name: 'Karthik Sundaram',
    email: 'karthik@sundaramlogistics.com',
    phone: '+91 98410 33214',
    segment: 'ENTERPRISE',
    lifetimeValue: 390000,
    totalTransactions: 19,
    pastRecoveries: 4,
    fatigueScore: 35,
    riskScore: 10,
    cardLast4: '1190',
    cardBrand: 'VISA',
    bankName: 'Kotak Mahindra Bank',
  },
  {
    id: 'cust_006',
    name: 'Devendra Verma',
    email: 'dev.verma88@yahoo.com',
    phone: '+91 91234 56789',
    segment: 'CONSUMER',
    lifetimeValue: 4200,
    totalTransactions: 2,
    pastRecoveries: 0,
    fatigueScore: 10,
    riskScore: 92, // HIGH FRAUD RISK -> SUPPRESSION
    cardLast4: '9901',
    cardBrand: 'VISA',
    bankName: 'IndusInd Bank',
  },
  {
    id: 'cust_007',
    name: 'Sneha Kulkarni',
    email: 'sneha.k@puneinnovate.in',
    phone: '+91 98901 23456',
    segment: 'SMB',
    lifetimeValue: 92000,
    totalTransactions: 14,
    pastRecoveries: 2,
    fatigueScore: 20,
    riskScore: 16,
    upiVpa: 'snehak@apl',
    bankName: 'HDFC Bank',
  },
  {
    id: 'cust_008',
    name: 'Arjun Singhania',
    email: 'arjun@singhaniacapital.com',
    phone: '+91 98111 88877',
    segment: 'VIP',
    lifetimeValue: 620000,
    totalTransactions: 31,
    pastRecoveries: 5,
    fatigueScore: 45,
    riskScore: 9,
    cardLast4: '7723',
    cardBrand: 'AMEX',
    bankName: 'American Express',
  },
  {
    id: 'cust_009',
    name: 'Meera Joshi',
    email: 'meera.joshi@mumbaiapp.co',
    phone: '+91 98200 11223',
    segment: 'CONSUMER',
    lifetimeValue: 28000,
    totalTransactions: 9,
    pastRecoveries: 1,
    fatigueScore: 30,
    riskScore: 18,
    upiVpa: 'meerajoshi@okhdfcbank',
    bankName: 'HDFC Bank',
  },
  {
    id: 'cust_010',
    name: 'Rohan Gupta',
    email: 'rohan@guptaretail.in',
    phone: '+91 97110 55443',
    segment: 'SMB',
    lifetimeValue: 115000,
    totalTransactions: 16,
    pastRecoveries: 3,
    fatigueScore: 50,
    riskScore: 15,
    upiVpa: 'rohan.gupta@icici',
    cardLast4: '3489',
    cardBrand: 'RUPAY',
    bankName: 'ICICI Bank',
  },
];

interface RawTxnSpec {
  id: string;
  orderId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  createdAt: string;
  failureCode: string;
  customerIndex: number;
  requiresApprovalManual?: boolean;
}

const SEED_TXN_SPECS: RawTxnSpec[] = [
  {
    id: 'txn_rcvq_101',
    orderId: 'ord_saas_98214',
    amount: 14500,
    paymentMethod: 'UPI',
    status: 'NEEDS_APPROVAL',
    createdAt: '2026-08-31T18:45:00Z',
    failureCode: 'AUTHENTICATION_FAILED_3DS',
    customerIndex: 0, // Vikramaditya (VIP)
    requiresApprovalManual: true,
  },
  {
    id: 'txn_rcvq_102',
    orderId: 'ord_saas_98215',
    amount: 32000,
    paymentMethod: 'CARD',
    status: 'NEEDS_APPROVAL',
    createdAt: '2026-08-31T18:15:00Z',
    failureCode: 'GATEWAY_TIMEOUT',
    customerIndex: 1, // Ananya (High Amount > ₹15,000)
    requiresApprovalManual: true,
  },
  {
    id: 'txn_rcvq_103',
    orderId: 'ord_saas_98216',
    amount: 4500,
    paymentMethod: 'UPI',
    status: 'SUPPRESSED',
    createdAt: '2026-08-31T17:50:00Z',
    failureCode: 'INSUFFICIENT_FUNDS',
    customerIndex: 2, // Rahul Sharma (High Fatigue 88)
  },
  {
    id: 'txn_rcvq_104',
    orderId: 'ord_saas_98217',
    amount: 18500,
    paymentMethod: 'CARD',
    status: 'SUPPRESSED',
    createdAt: '2026-08-31T17:10:00Z',
    failureCode: 'HIGH_RISK_SUSPECTED',
    customerIndex: 5, // Devendra Verma (Risk 92)
  },
  {
    id: 'txn_rcvq_105',
    orderId: 'ord_saas_98218',
    amount: 6800,
    paymentMethod: 'UPI',
    status: 'RECOVERING',
    createdAt: '2026-08-31T16:30:00Z',
    failureCode: 'CUSTOMER_DROPOUT',
    customerIndex: 3, // Priya Nair
  },
  {
    id: 'txn_rcvq_106',
    orderId: 'ord_saas_98219',
    amount: 24000,
    paymentMethod: 'MANDATE',
    status: 'RECOVERING',
    createdAt: '2026-08-31T15:45:00Z',
    failureCode: 'MANDATE_INACTIVE',
    customerIndex: 4, // Karthik
  },
  {
    id: 'txn_rcvq_107',
    orderId: 'ord_saas_98220',
    amount: 8500,
    paymentMethod: 'UPI',
    status: 'RECOVERED',
    createdAt: '2026-08-31T14:20:00Z',
    failureCode: 'AUTHENTICATION_FAILED_3DS',
    customerIndex: 6, // Sneha
  },
  {
    id: 'txn_rcvq_108',
    orderId: 'ord_saas_98221',
    amount: 54000,
    paymentMethod: 'CARD',
    status: 'NEEDS_APPROVAL',
    createdAt: '2026-08-31T13:10:00Z',
    failureCode: 'BANK_SERVER_DOWN',
    customerIndex: 7, // Arjun (VIP + High Ticket)
    requiresApprovalManual: true,
  },
  {
    id: 'txn_rcvq_109',
    orderId: 'ord_saas_98222',
    amount: 3200,
    paymentMethod: 'UPI',
    status: 'RECOVERED',
    createdAt: '2026-08-31T12:05:00Z',
    failureCode: 'BAD_REQUEST_ERROR',
    customerIndex: 8, // Meera
  },
  {
    id: 'txn_rcvq_110',
    orderId: 'ord_saas_98223',
    amount: 11200,
    paymentMethod: 'NETBANKING',
    status: 'RECOVERING',
    createdAt: '2026-08-31T11:30:00Z',
    failureCode: 'GATEWAY_TIMEOUT',
    customerIndex: 9, // Rohan
  },
  {
    id: 'txn_rcvq_111',
    orderId: 'ord_saas_98224',
    amount: 7500,
    paymentMethod: 'UPI',
    status: 'RECOVERED',
    createdAt: '2026-08-31T10:15:00Z',
    failureCode: 'INSUFFICIENT_FUNDS',
    customerIndex: 0,
  },
  {
    id: 'txn_rcvq_112',
    orderId: 'ord_saas_98225',
    amount: 19500,
    paymentMethod: 'CARD',
    status: 'NEEDS_APPROVAL',
    createdAt: '2026-08-31T09:40:00Z',
    failureCode: 'CARD_EXPIRED',
    customerIndex: 1,
    requiresApprovalManual: true,
  },
  {
    id: 'txn_rcvq_113',
    orderId: 'ord_saas_98226',
    amount: 2900,
    paymentMethod: 'UPI',
    status: 'RECOVERED',
    createdAt: '2026-08-31T08:55:00Z',
    failureCode: 'CUSTOMER_DROPOUT',
    customerIndex: 3,
  },
  {
    id: 'txn_rcvq_114',
    orderId: 'ord_saas_98227',
    amount: 16200,
    paymentMethod: 'MANDATE',
    status: 'FAILED',
    createdAt: '2026-08-30T22:15:00Z',
    failureCode: 'VPA_NOT_FOUND',
    customerIndex: 4,
  },
  {
    id: 'txn_rcvq_115',
    orderId: 'ord_saas_98228',
    amount: 42000,
    paymentMethod: 'CARD',
    status: 'RECOVERED',
    createdAt: '2026-08-30T20:30:00Z',
    failureCode: 'GATEWAY_TIMEOUT',
    customerIndex: 7,
  },
];

function buildDecisionTrace(
  txnId: string,
  amount: number,
  status: PaymentStatus,
  action: RecoveryActionType,
  category: FailureCategory,
  createdAt: string,
  customer: CustomerProfile,
  requiresApproval: boolean
): DecisionTraceStep[] {
  const t0 = new Date(createdAt);
  const addSecs = (s: number) => new Date(t0.getTime() + s * 1000).toISOString();

  return [
    {
      step: 1,
      name: 'DETECT',
      timestamp: addSecs(0),
      status: 'COMPLETED',
      summary: `Payment gateway webhook 'payment.failed' captured for ₹${amount.toLocaleString('en-IN')}`,
      details: {
        event: 'payment.failed',
        gateway: 'Razorpay Switch',
        latencyMs: 142,
      },
    },
    {
      step: 2,
      name: 'DIAGNOSE',
      timestamp: addSecs(2),
      status: 'COMPLETED',
      summary: `Classified failure category as ${category.replace(/_/g, ' ')}. Root cause isolated.`,
      details: {
        category,
        customerSegment: customer.segment,
        bank: customer.bankName,
      },
    },
    {
      step: 3,
      name: 'PREDICT',
      timestamp: addSecs(4),
      status: 'COMPLETED',
      summary: `ML probability model computed success rate & customer fatigue discount (${customer.fatigueScore}/100).`,
      details: {
        fatigueScore: customer.fatigueScore,
        riskScore: customer.riskScore,
        pastRecoveries: customer.pastRecoveries,
      },
    },
    {
      step: 4,
      name: 'SIMULATE',
      timestamp: addSecs(6),
      status: 'COMPLETED',
      summary: 'Simulated 6 recovery vectors: Immediate Retry vs Delayed vs WhatsApp vs Link vs Escalation.',
      details: {
        simulatedChannels: ['GATEWAY_RETRY', 'WHATSAPP_API', 'PAYMENT_LINK', 'MANUAL_DESK'],
      },
    },
    {
      step: 5,
      name: 'OPTIMIZE',
      timestamp: addSecs(8),
      status: 'COMPLETED',
      summary: `Selected optimal action '${action}' with highest Expected Recovery Value.`,
      details: {
        selectedStrategy: action,
      },
    },
    {
      step: 6,
      name: 'APPROVE',
      timestamp: addSecs(10),
      status: requiresApproval ? (status === 'NEEDS_APPROVAL' ? 'AWAITING_APPROVAL' : 'COMPLETED') : 'COMPLETED',
      summary: requiresApproval
        ? (status === 'NEEDS_APPROVAL' ? 'High ticket/VIP threshold flagged. Awaiting merchant human sign-off.' : 'Approved by Merchant Admin.')
        : 'Automated policy guardrails passed. Auto-dispatched.',
      details: {
        requiresHumanApproval: requiresApproval,
        autoApprovalCeilingINR: 15000,
      },
    },
    {
      step: 7,
      name: 'EXECUTE',
      timestamp: addSecs(15),
      status: status === 'RECOVERED' || status === 'RECOVERING' ? 'COMPLETED' : (status === 'SUPPRESSED' ? 'SKIPPED' : 'IN_PROGRESS'),
      summary: status === 'SUPPRESSED'
        ? 'Action suppressed by Why NOT Recover policy.'
        : `Dispatched ${action} through corresponding communications and gateway pipeline.`,
      details: {
        channel: action === 'WHATSAPP_NUDGE' ? 'Meta Cloud API' : 'Razorpay Direct API',
      },
    },
    {
      step: 8,
      name: 'MEASURE',
      timestamp: addSecs(180),
      status: status === 'RECOVERED' ? 'COMPLETED' : (status === 'FAILED' ? 'FAILED' : 'IN_PROGRESS'),
      summary: status === 'RECOVERED'
        ? `₹${amount.toLocaleString('en-IN')} successfully recovered and reconciled. Model weights updated.`
        : (status === 'SUPPRESSED' ? 'Loss avoided. Relationship preserved.' : 'Awaiting settlement telemetry webhook.'),
      details: {
        outcome: status,
      },
    },
  ];
}

export function generateInitialTransactions(): Transaction[] {
  return SEED_TXN_SPECS.map((spec) => {
    const customer = RAW_CUSTOMERS[spec.customerIndex % RAW_CUSTOMERS.length];
    const failureInfo = classifyPaymentFailure(spec.failureCode, spec.paymentMethod);
    const recommendation = evaluateRecoveryStrategies(
      spec.amount,
      failureInfo.category,
      spec.failureCode,
      spec.paymentMethod,
      customer
    );
    const ev = calculateExpectedRecoveryValue(
      spec.amount,
      recommendation.recommendedAction,
      failureInfo.category,
      spec.paymentMethod,
      customer
    );
    const policyResult = evaluatePolicyGuardrails(
      spec.amount,
      recommendation.recommendedAction,
      recommendation.actionConfidence,
      customer
    );

    const requiresApproval = spec.requiresApprovalManual ?? policyResult.requiresHumanApproval;
    const currentStatus: PaymentStatus = spec.status;

    const trace = buildDecisionTrace(
      spec.id,
      spec.amount,
      currentStatus,
      recommendation.recommendedAction,
      failureInfo.category,
      spec.createdAt,
      customer,
      requiresApproval
    );

    return {
      id: spec.id,
      merchantId: INITIAL_MERCHANT.id,
      merchantName: INITIAL_MERCHANT.name,
      orderId: spec.orderId,
      paymentId: `pay_${spec.id.replace('txn_', '')}`,
      amount: spec.amount,
      currency: 'INR',
      paymentMethod: spec.paymentMethod,
      status: currentStatus,
      createdAt: spec.createdAt,
      updatedAt: spec.createdAt,
      failureCode: spec.failureCode,
      failureMessage: failureInfo.merchantDescription,
      failureCategory: failureInfo.category,
      rawGatewayResponse: {
        error: {
          code: spec.failureCode,
          description: failureInfo.technicalDescription,
          source: 'gateway',
          step: 'payment_authentication',
          reason: spec.failureCode.toLowerCase(),
        },
      },
      customer,
      recoveryProbability: recommendation.recoveryProbability,
      expectedRecoveryValue: recommendation.expectedRecoveryValue,
      recommendedAction: recommendation.recommendedAction,
      actionConfidence: recommendation.actionConfidence,
      aiRationale: recommendation.aiRationale,
      whyNotRationale: recommendation.whyNotRationale,
      evBreakdown: ev,
      strategyYields: recommendation.strategyYields,
      requiresApproval,
      approvalReason: requiresApproval ? (policyResult.approvalReasons[0] || 'Requires manual review per merchant policy.') : undefined,
      executionChannel: recommendation.recommendedAction === 'WHATSAPP_NUDGE' ? 'WhatsApp Business' : 'Razorpay Gateway',
      executionStatus: currentStatus === 'RECOVERED' ? 'SUCCEEDED' : (currentStatus === 'RECOVERING' ? 'DISPATCHED' : 'PENDING'),
      recoveredAt: currentStatus === 'RECOVERED' ? '2026-08-31T19:00:00Z' : undefined,
      recoveredAmount: currentStatus === 'RECOVERED' ? spec.amount : undefined,
      decisionTrace: trace,
    };
  });
}

export const INITIAL_EXPERIMENTS: RecoveryExperiment[] = [
  {
    id: 'exp_001',
    title: 'AI Multi-Touch Dynamic Routing vs Blind Immediate Retry',
    hypothesis: 'Dynamic EV routing based on failure root causes will increase recovery yield by >35% while cutting customer fatigue in half compared to blind retries.',
    status: 'RUNNING',
    startDate: '2026-08-15T00:00:00Z',
    totalTraffic: 1420,
    controlArm: {
      id: 'arm_control',
      name: 'Control (Blind Immediate Retry)',
      actionType: 'IMMEDIATE_RETRY',
      trafficAllocationPercent: 30,
      sampleSize: 426,
      recoveredCount: 122,
      recoveredRevenueINR: 580000,
      recoveryRatePercent: 28.6,
      totalInterventionCostINR: 850,
      netRecoveredINR: 579150,
      averageTimeToRecoverMinutes: 12,
      statisticalConfidence: 95.0,
    },
    variantArms: [
      {
        id: 'arm_ai_dynamic',
        name: 'Variant A (RecoverIQ AI Engine)',
        actionType: 'AI_DYNAMIC',
        trafficAllocationPercent: 70,
        sampleSize: 994,
        recoveredCount: 718,
        recoveredRevenueINR: 3410000,
        recoveryRatePercent: 72.2,
        totalInterventionCostINR: 2480,
        netRecoveredINR: 3407520,
        averageTimeToRecoverMinutes: 44,
        statisticalConfidence: 99.8,
        isWinner: true,
      },
    ],
    insights: [
      'RecoverIQ AI yielded a +152% relative increase in recovered revenue.',
      'Customer unsubscribe and churn rate dropped from 4.2% to 0.4% due to intelligent suppression of high-fatigue customers.',
      'WhatsApp 1-tap conversion for 3DS drops exceeded 84% within 15 minutes of trigger.',
    ],
  },
  {
    id: 'exp_002',
    title: 'WhatsApp 1-Tap Payment Link vs Standard SMS Payment Link',
    hypothesis: 'WhatsApp interactive message templates with 1-click UPI deep links will achieve 2.5x higher checkout completion than plain SMS payment links.',
    status: 'RUNNING',
    startDate: '2026-08-20T00:00:00Z',
    totalTraffic: 860,
    controlArm: {
      id: 'arm_sms',
      name: 'Control (Standard SMS Link)',
      actionType: 'PAYMENT_LINK',
      trafficAllocationPercent: 50,
      sampleSize: 430,
      recoveredCount: 184,
      recoveredRevenueINR: 874000,
      recoveryRatePercent: 42.8,
      totalInterventionCostINR: 1376,
      netRecoveredINR: 872624,
      averageTimeToRecoverMinutes: 180,
      statisticalConfidence: 90.0,
    },
    variantArms: [
      {
        id: 'arm_wa',
        name: 'Variant B (WhatsApp 1-Tap Deep Link)',
        actionType: 'WHATSAPP_NUDGE',
        trafficAllocationPercent: 50,
        sampleSize: 430,
        recoveredCount: 308,
        recoveredRevenueINR: 1463000,
        recoveryRatePercent: 71.6,
        totalInterventionCostINR: 645,
        netRecoveredINR: 1462355,
        averageTimeToRecoverMinutes: 28,
        statisticalConfidence: 99.2,
        isWinner: true,
      },
    ],
    insights: [
      'WhatsApp reduced mean time to recovery from 3 hours to 28 minutes.',
      'Open rates on WhatsApp reached 96.4% compared to 21.2% for SMS.',
    ],
  },
];

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'aud_901',
    timestamp: '2026-08-31T18:45:10Z',
    actorType: 'AI_AGENT',
    actorName: 'RecoverIQ Decision Intelligence',
    action: 'EVALUATE_AND_RECOMMEND',
    entityType: 'TRANSACTION',
    entityId: 'txn_rcvq_101',
    details: 'Evaluated failure AUTHENTICATION_FAILED_3DS. Selected WHATSAPP_NUDGE (EV: ₹12,470, Confidence: 91%). Triggered approval gate due to VIP status.',
    integrityHash: 'sha256:8f2a9910d938b7e41103c842aa1',
  },
  {
    id: 'aud_902',
    timestamp: '2026-08-31T17:50:05Z',
    actorType: 'POLICY_ENGINE',
    actorName: 'Customer Fatigue Protection Rule #14',
    action: 'SUPPRESS_RECOVERY',
    entityType: 'TRANSACTION',
    entityId: 'txn_rcvq_103',
    details: 'Hard suppression triggered: Customer Rahul Sharma fatigue score (88/100) exceeded limit (80). Churn risk prevented.',
    integrityHash: 'sha256:7c9e1201fa4546bb098192a009e',
  },
  {
    id: 'aud_903',
    timestamp: '2026-08-31T17:10:04Z',
    actorType: 'POLICY_ENGINE',
    actorName: 'Fraud Risk Firewall Rule #412',
    action: 'SUPPRESS_RECOVERY',
    entityType: 'TRANSACTION',
    entityId: 'txn_rcvq_104',
    details: 'Hard suppression triggered: Transaction flagged as HIGH_RISK_SUSPECTED. Suppressed to prevent ₹1,500 dispute chargeback.',
    integrityHash: 'sha256:1a84f339bb2c109d789012aefbc',
  },
  {
    id: 'aud_904',
    timestamp: '2026-08-31T14:20:15Z',
    actorType: 'GATEWAY_WEBHOOK',
    actorName: 'Razorpay Switch Telemetry',
    action: 'PAYMENT_CAPTURED',
    entityType: 'TRANSACTION',
    entityId: 'txn_rcvq_107',
    details: 'Settlement confirmed for ₹8,500 via WhatsApp 1-tap link. Reconciliation completed with zero discrepancies.',
    integrityHash: 'sha256:4d609ab318721cdef445981299a',
  },
  {
    id: 'aud_905',
    timestamp: '2026-08-31T12:05:12Z',
    actorType: 'MERCHANT_ADMIN',
    actorName: 'Ujjwal Admin (ujjwal@saasify.in)',
    action: 'POLICY_UPDATE',
    entityType: 'POLICY',
    entityId: 'policy_default_in',
    details: 'Increased auto-approval ceiling from ₹10,000 to ₹15,000 and enabled automated WhatsApp 1-tap payment links.',
    integrityHash: 'sha256:99bc4512e0984f1837a2410a881',
  },
];
