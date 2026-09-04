import { PrismaClient, Role, PaymentMethod, PaymentStatus, FailureCategory, RecoveryActionType, SubscriptionPlan, SubscriptionStatus, AttemptStatus, ModelType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting RecoverIQ multi-tenant database seed...');

  // 1. AI Model Registry
  console.log('Registering AI Model Versions...');
  const modelV2 = await prisma.aIModelVersion.upsert({
    where: { version: 'RecoverIQ-Bandit-v2.4' },
    update: {},
    create: {
      name: 'Dynamic Multi-Armed Contextual Recovery Bandit',
      version: 'RecoverIQ-Bandit-v2.4',
      modelType: ModelType.MULTI_ARMED_BANDIT,
      accuracy: 0.894,
      isActive: true,
      description: 'Production Bayesian contextual bandit optimizing expected recovery value net of customer fatigue penalty.',
    },
  });

  // 2. Merchant 1: SaaSify Technologies India Pvt Ltd (Primary Tenant)
  console.log('Seeding Merchant 1: SaaSify Technologies...');
  const passwordHash = await bcrypt.hash('password123', 10);

  const merchantSaaSify = await prisma.merchant.upsert({
    where: { id: 'mer_saasify_blr' },
    update: {},
    create: {
      id: 'mer_saasify_blr',
      name: 'SaaSify Technologies India Pvt Ltd',
      businessType: 'SAAS',
      currency: 'INR',
    },
  });

  // Merchant 1 Users (RBAC Foundation)
  await prisma.merchantUser.upsert({
    where: { email: 'merchant@saasify.in' },
    update: {},
    create: {
      merchantId: merchantSaaSify.id,
      name: 'Ujjwal (Admin)',
      email: 'merchant@saasify.in',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  await prisma.merchantUser.upsert({
    where: { email: 'owner@saasify.in' },
    update: {},
    create: {
      merchantId: merchantSaaSify.id,
      name: 'Vikramaditya (Founder & CEO)',
      email: 'owner@saasify.in',
      passwordHash,
      role: Role.OWNER,
    },
  });

  await prisma.merchantUser.upsert({
    where: { email: 'analyst@saasify.in' },
    update: {},
    create: {
      merchantId: merchantSaaSify.id,
      name: 'Priya Sharma (Risk Analyst)',
      email: 'analyst@saasify.in',
      passwordHash,
      role: Role.ANALYST,
    },
  });

  await prisma.merchantUser.upsert({
    where: { email: 'ops@saasify.in' },
    update: {},
    create: {
      merchantId: merchantSaaSify.id,
      name: 'Rahul Nair (Recovery Operator)',
      email: 'ops@saasify.in',
      passwordHash,
      role: Role.OPERATOR,
    },
  });

  // Policy Guardrails for SaaSify
  await prisma.policyGuardrails.upsert({
    where: { merchantId: merchantSaaSify.id },
    update: {},
    create: {
      merchantId: merchantSaaSify.id,
      autoApproveMaxAmount: 15000,
      minConfidenceForAutoApprove: 80,
      maxCustomerFatigueThreshold: 70,
      maxRetriesPerCustomerPerWeek: 3,
      disputeRiskBlockThreshold: 60,
      allowAutomatedWhatsApp: true,
      allowAutomatedPaymentLinks: true,
      humanApprovalForVIPs: true,
      nightHoursRetrySilence: true,
    },
  });

  // Subscription & Usage for SaaSify
  await prisma.subscription.create({
    data: {
      merchantId: merchantSaaSify.id,
      plan: SubscriptionPlan.GROWTH,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(Date.now() - 15 * 86400000),
      currentPeriodEnd: new Date(Date.now() + 15 * 86400000),
    },
  });

  await prisma.usageRecord.upsert({
    where: {
      merchantId_month: {
        merchantId: merchantSaaSify.id,
        month: '2026-09',
      },
    },
    update: {},
    create: {
      merchantId: merchantSaaSify.id,
      month: '2026-09',
      recoveredAmountINR: 1942000,
      apiCallsCount: 14250,
      recoveryAttemptsCount: 38,
    },
  });

  // 3. Merchant 2: QuickCart Commerce D2C (To verify multi-tenant isolation)
  console.log('Seeding Merchant 2: QuickCart Commerce...');
  const merchantQuickCart = await prisma.merchant.upsert({
    where: { id: 'mer_quickcart_delhi' },
    update: {},
    create: {
      id: 'mer_quickcart_delhi',
      name: 'QuickCart Commerce D2C Pvt Ltd',
      businessType: 'ECOMMERCE',
      currency: 'INR',
    },
  });

  await prisma.merchantUser.upsert({
    where: { email: 'admin@quickcart.in' },
    update: {},
    create: {
      merchantId: merchantQuickCart.id,
      name: 'Rohit Mehta',
      email: 'admin@quickcart.in',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  await prisma.policyGuardrails.upsert({
    where: { merchantId: merchantQuickCart.id },
    update: {},
    create: {
      merchantId: merchantQuickCart.id,
      autoApproveMaxAmount: 5000,
      minConfidenceForAutoApprove: 85,
      maxCustomerFatigueThreshold: 50,
      maxRetriesPerCustomerPerWeek: 2,
      disputeRiskBlockThreshold: 50,
      allowAutomatedWhatsApp: true,
      allowAutomatedPaymentLinks: false,
      humanApprovalForVIPs: true,
      nightHoursRetrySilence: true,
    },
  });

  // 4. Customers for SaaSify
  console.log('Seeding SaaSify Customers with Recovery Profiles...');
  const customersData = [
    {
      id: 'cust_001',
      name: 'Vikramaditya Rao',
      email: 'vikram.rao@fintechnext.in',
      phone: '+91 98201 44521',
      segment: 'VIP',
      lifetimeValue: 245000,
      totalTransactions: 18,
      profile: { pastRecoveries: 3, fatigueScore: 28, riskScore: 12, upiVpa: 'vikramaditya@okhdfcbank', cardLast4: '4092', bankName: 'HDFC Bank', preferredChannel: 'WHATSAPP' },
    },
    {
      id: 'cust_002',
      name: 'Ananya Deshmukh',
      email: 'ananya.d@cloudscale.io',
      phone: '+91 97690 12890',
      segment: 'ENTERPRISE',
      lifetimeValue: 480000,
      totalTransactions: 24,
      profile: { pastRecoveries: 1, fatigueScore: 15, riskScore: 8, cardLast4: '8821', cardBrand: 'MASTERCARD', bankName: 'ICICI Bank', preferredChannel: 'PAYMENT_LINK' },
    },
    {
      id: 'cust_003',
      name: 'Karthik Subramanian',
      email: 'karthik@hypergrowth.co',
      phone: '+91 94440 88219',
      segment: 'SMB',
      lifetimeValue: 92000,
      totalTransactions: 9,
      profile: { pastRecoveries: 2, fatigueScore: 78, riskScore: 18, upiVpa: 'karthik.sub@paytm', bankName: 'State Bank of India', preferredChannel: 'OPTIMAL_DELAYED_RETRY' },
    },
    {
      id: 'cust_004',
      name: 'Sunita Mehra',
      email: 'sunita.mehra@apexlegal.in',
      phone: '+91 98110 33490',
      segment: 'VIP',
      lifetimeValue: 310000,
      totalTransactions: 14,
      profile: { pastRecoveries: 4, fatigueScore: 42, riskScore: 9, cardLast4: '1109', cardBrand: 'AMEX', bankName: 'American Express', preferredChannel: 'HUMAN_ESCALATION' },
    },
    {
      id: 'cust_005',
      name: 'Rohan Banerjee',
      email: 'rohan.b@devfoundry.tech',
      phone: '+91 98300 66712',
      segment: 'CONSUMER',
      lifetimeValue: 18500,
      totalTransactions: 5,
      profile: { pastRecoveries: 0, fatigueScore: 10, riskScore: 5, upiVpa: 'rohanb@oksbi', bankName: 'State Bank of India', preferredChannel: 'WHATSAPP' },
    },
    {
      id: 'cust_006',
      name: 'Meera Nambiar',
      email: 'meera.n@solardynamics.in',
      phone: '+91 98450 11982',
      segment: 'SMB',
      lifetimeValue: 74000,
      totalTransactions: 8,
      profile: { pastRecoveries: 1, fatigueScore: 22, riskScore: 68, cardLast4: '3490', cardBrand: 'VISA', bankName: 'Axis Bank', preferredChannel: 'DO_NOT_RECOVER' },
    },
  ];

  for (const c of customersData) {
    const cust = await prisma.customer.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        merchantId: merchantSaaSify.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        segment: c.segment,
        lifetimeValue: c.lifetimeValue,
        totalTransactions: c.totalTransactions,
      },
    });

    await prisma.customerRecoveryProfile.upsert({
      where: { customerId: cust.id },
      update: {},
      create: {
        customerId: cust.id,
        pastRecoveries: c.profile.pastRecoveries,
        fatigueScore: c.profile.fatigueScore,
        riskScore: c.profile.riskScore,
        upiVpa: c.profile.upiVpa,
        cardLast4: c.profile.cardLast4,
        cardBrand: c.profile.cardBrand,
        bankName: c.profile.bankName,
        preferredChannel: c.profile.preferredChannel,
      },
    });
  }

  // 5. Transactions with Decoupled Recovery Attempts, Payment Events, and Decision Traces
  console.log('Seeding Transactions with multi-attempt decoupled histories...');

  const transactionsToSeed = [
    {
      id: 'txn_saas_001',
      customerId: 'cust_001',
      orderId: 'order_blr_98102',
      paymentId: 'pay_rzp_fail_001',
      amount: 18500,
      paymentMethod: PaymentMethod.UPI,
      status: PaymentStatus.NEEDS_APPROVAL,
      failureCode: 'BAD_REQUEST_ERROR_NPCI_TIMED_OUT',
      failureMessage: 'NPCI UPI switch response timeout after 30000ms',
      failureCategory: FailureCategory.TECHNICAL,
      recoveryProbability: 0.84,
      expectedRecoveryValue: 15480,
      recommendedAction: RecoveryActionType.OPTIMAL_DELAYED_RETRY,
      actionConfidence: 89,
      aiRationale: 'Transient NPCI bank switch timeout. UPI server stability usually returns within 4 hours with 84% recovery probability.',
      requiresApproval: true,
      approvalReason: 'VIP Customer & Ticket size exceeds auto-approve threshold of ₹15,000.',
      attempts: [
        {
          attemptNumber: 1,
          actionType: RecoveryActionType.IMMEDIATE_RETRY,
          channel: 'GATEWAY_RETRY',
          status: AttemptStatus.FAILED,
          errorMessage: 'Gateway returned NPCI timeout during attempt #1',
          dispatchedAt: new Date(Date.now() - 3600000 * 5),
          completedAt: new Date(Date.now() - 3600000 * 5 + 12000),
        },
      ],
    },
    {
      id: 'txn_saas_002',
      customerId: 'cust_002',
      orderId: 'order_blr_98103',
      paymentId: 'pay_rzp_succ_002',
      amount: 42000,
      paymentMethod: PaymentMethod.CARD,
      status: PaymentStatus.RECOVERED,
      failureCode: 'PAYMENT_FAILED_AUTH_STEP_UP',
      failureMessage: 'Card authentication failed: 3D Secure session expired',
      failureCategory: FailureCategory.AUTHENTICATION,
      recoveryProbability: 0.92,
      expectedRecoveryValue: 38600,
      recommendedAction: RecoveryActionType.PAYMENT_LINK,
      actionConfidence: 94,
      aiRationale: 'High lifetime value enterprise account. Sent branded instant checkout link with auto-populated mandate.',
      requiresApproval: false,
      approvedBy: 'Auto-Policy Engine (Guardrails passed)',
      approvedAt: new Date(Date.now() - 3600000 * 12),
      executionChannel: 'WHATSAPP_CHECKOUT_LINK',
      executionStatus: 'SUCCEEDED',
      recoveredAt: new Date(Date.now() - 3600000 * 10),
      recoveredAmount: 42000,
      attempts: [
        {
          attemptNumber: 1,
          actionType: RecoveryActionType.PAYMENT_LINK,
          channel: 'WHATSAPP_CHECKOUT_LINK',
          status: AttemptStatus.PAID,
          recoveredAmount: 42000,
          gatewayPaymentId: 'pay_recovered_99012',
          dispatchedAt: new Date(Date.now() - 3600000 * 12),
          completedAt: new Date(Date.now() - 3600000 * 10),
        },
      ],
    },
    {
      id: 'txn_saas_003',
      customerId: 'cust_003',
      orderId: 'order_blr_98104',
      paymentId: 'pay_rzp_fail_003',
      amount: 8900,
      paymentMethod: PaymentMethod.UPI,
      status: PaymentStatus.RECOVERING,
      failureCode: 'INSUFFICIENT_FUNDS_OR_LIMIT',
      failureMessage: 'Bank account balance limit exceeded for UPI transaction',
      failureCategory: FailureCategory.INSUFFICIENT_FUNDS,
      recoveryProbability: 0.76,
      expectedRecoveryValue: 6720,
      recommendedAction: RecoveryActionType.WHATSAPP_NUDGE,
      actionConfidence: 82,
      aiRationale: 'Customer has history of salary credit on 1st/3rd. Scheduled gentle payment nudge via WhatsApp with 1-click retry.',
      requiresApproval: false,
      executionChannel: 'WHATSAPP_MESSAGE',
      executionStatus: 'DISPATCHED',
      attempts: [
        {
          attemptNumber: 1,
          actionType: RecoveryActionType.OPTIMAL_DELAYED_RETRY,
          channel: 'GATEWAY_RETRY',
          status: AttemptStatus.FAILED,
          errorMessage: 'Account still showed insufficient balance',
          dispatchedAt: new Date(Date.now() - 3600000 * 20),
          completedAt: new Date(Date.now() - 3600000 * 20 + 5000),
        },
        {
          attemptNumber: 2,
          actionType: RecoveryActionType.WHATSAPP_NUDGE,
          channel: 'WHATSAPP_MESSAGE',
          status: AttemptStatus.DELIVERED,
          dispatchedAt: new Date(Date.now() - 3600000 * 2),
        },
      ],
    },
    {
      id: 'txn_saas_004',
      customerId: 'cust_004',
      orderId: 'order_blr_98105',
      paymentId: 'pay_rzp_fail_004',
      amount: 28000,
      paymentMethod: PaymentMethod.CARD,
      status: PaymentStatus.NEEDS_APPROVAL,
      failureCode: 'CARD_DECLINED_HIGH_VALUE_SECURITY',
      failureMessage: 'Issuing bank security hold on high value international recurring charge',
      failureCategory: FailureCategory.RISK_AND_FRAUD,
      recoveryProbability: 0.65,
      expectedRecoveryValue: 17800,
      recommendedAction: RecoveryActionType.HUMAN_ESCALATION,
      actionConfidence: 78,
      aiRationale: 'VIP customer. Amex issuer declined high value transaction. Recommends dedicated relationship manager outreach.',
      requiresApproval: true,
      approvalReason: 'VIP Customer flagged for human escalation review.',
      attempts: [],
    },
    {
      id: 'txn_saas_005',
      customerId: 'cust_006',
      orderId: 'order_blr_98106',
      paymentId: 'pay_rzp_fail_005',
      amount: 14500,
      paymentMethod: PaymentMethod.CARD,
      status: PaymentStatus.SUPPRESSED,
      failureCode: 'DISPUTE_SUSPECTED_CHARGEBACK',
      failureMessage: 'Cardholder previously initiated dispute for merchant MID',
      failureCategory: FailureCategory.RISK_AND_FRAUD,
      recoveryProbability: 0.12,
      expectedRecoveryValue: 1200,
      recommendedAction: RecoveryActionType.DO_NOT_RECOVER,
      actionConfidence: 96,
      aiRationale: 'Customer dispute risk score is 68% (above 60% threshold). Suppressed automated recovery to prevent chargeback penalties.',
      requiresApproval: false,
      approvalReason: 'Suppressed by Dispute Risk Guardrail.',
      attempts: [],
    },
  ];

  for (const t of transactionsToSeed) {
    const createdTxn = await prisma.transaction.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id,
        merchantId: merchantSaaSify.id,
        customerId: t.customerId,
        orderId: t.orderId,
        paymentId: t.paymentId,
        amount: t.amount,
        currency: 'INR',
        paymentMethod: t.paymentMethod,
        status: t.status,
        failureCode: t.failureCode,
        failureMessage: t.failureMessage,
        failureCategory: t.failureCategory,
        recoveryProbability: t.recoveryProbability,
        expectedRecoveryValue: t.expectedRecoveryValue,
        recommendedAction: t.recommendedAction,
        actionConfidence: t.actionConfidence,
        aiRationale: t.aiRationale,
        requiresApproval: t.requiresApproval,
        approvalReason: t.approvalReason,
        approvedBy: t.approvedBy,
        approvedAt: t.approvedAt,
        executionChannel: t.executionChannel,
        executionStatus: t.executionStatus,
        recoveredAt: t.recoveredAt,
        recoveredAmount: t.recoveredAmount,
      },
    });

    // Seed Payment Event
    await prisma.paymentEvent.create({
      data: {
        transactionId: createdTxn.id,
        eventType: 'PAYMENT_FAILED',
        amount: createdTxn.amount,
        status: 'FAILED',
        gatewayErrorCode: createdTxn.failureCode,
        gatewayErrorMessage: createdTxn.failureMessage,
      },
    });

    // Seed Decision & Traces
    const decision = await prisma.decision.create({
      data: {
        transactionId: createdTxn.id,
        recommendedAction: createdTxn.recommendedAction,
        confidenceScore: createdTxn.actionConfidence,
        recoveryProbability: createdTxn.recoveryProbability,
        expectedRecoveryValue: createdTxn.expectedRecoveryValue,
        modelId: modelV2.id,
        rationale: createdTxn.aiRationale,
        status: createdTxn.requiresApproval ? 'PENDING' : 'APPROVED',
      },
    });

    await prisma.decisionTrace.createMany({
      data: [
        {
          decisionId: decision.id,
          step: 1,
          name: 'DETECT',
          status: 'COMPLETED',
          summary: `Captured gateway failure: ${createdTxn.failureCode}`,
        },
        {
          decisionId: decision.id,
          step: 2,
          name: 'DIAGNOSE',
          status: 'COMPLETED',
          summary: `Classified as ${createdTxn.failureCategory}`,
        },
        {
          decisionId: decision.id,
          step: 3,
          name: 'PREDICT',
          status: 'COMPLETED',
          summary: `Calculated recovery probability: ${Math.round(createdTxn.recoveryProbability * 100)}%`,
        },
        {
          decisionId: decision.id,
          step: 4,
          name: 'SIMULATE',
          status: 'COMPLETED',
          summary: `Estimated Net Expected Recovery Value: ₹${createdTxn.expectedRecoveryValue.toLocaleString('en-IN')}`,
        },
        {
          decisionId: decision.id,
          step: 5,
          name: 'OPTIMIZE',
          status: 'COMPLETED',
          summary: `Optimal action: ${createdTxn.recommendedAction} (Confidence: ${createdTxn.actionConfidence}%)`,
        },
      ],
    });

    // Seed Decoupled Recovery Attempts
    for (const att of (t.attempts as any[])) {
      await prisma.recoveryAttempt.create({
        data: {
          transactionId: createdTxn.id,
          attemptNumber: att.attemptNumber,
          actionType: att.actionType,
          channel: att.channel,
          status: att.status,
          dispatchedAt: att.dispatchedAt,
          completedAt: att.completedAt || null,
          recoveredAmount: att.recoveredAmount || null,
          gatewayPaymentId: att.gatewayPaymentId || null,
          errorMessage: att.errorMessage || null,
        },
      });
    }
  }

  // 6. Recovery Experiments for SaaSify
  console.log('Seeding Recovery Experiments...');
  await prisma.recoveryExperiment.create({
    data: {
      merchantId: merchantSaaSify.id,
      title: 'Dynamic Multi-Arm WhatsApp Nudge vs Instant Gateway Retry',
      hypothesis: 'Personalized WhatsApp checkout links with 1-click UPI authorization recover 35% more revenue for insufficient fund failures without increasing spam fatigue.',
      status: 'RUNNING',
      totalTraffic: 1420,
      controlArm: {
        id: 'arm_control',
        name: 'Control (Standard 4hr Delayed Retry)',
        actionType: 'OPTIMAL_DELAYED_RETRY',
        trafficAllocationPercent: 50,
        sampleSize: 710,
        recoveredCount: 312,
        recoveredRevenueINR: 592800,
        recoveryRatePercent: 43.9,
        totalInterventionCostINR: 2130,
        netRecoveredINR: 590670,
        averageTimeToRecoverMinutes: 245,
        statisticalConfidence: 50.0,
      },
      variantArms: [
        {
          id: 'arm_variant_a',
          name: 'Variant (AI Contextual WhatsApp Nudge)',
          actionType: 'WHATSAPP_NUDGE',
          trafficAllocationPercent: 50,
          sampleSize: 710,
          recoveredCount: 462,
          recoveredRevenueINR: 877800,
          recoveryRatePercent: 65.1,
          totalInterventionCostINR: 1065,
          netRecoveredINR: 876735,
          averageTimeToRecoverMinutes: 48,
          statisticalConfidence: 99.4,
          isWinner: true,
        },
      ],
      insights: [
        'Variant achieved +21.2% higher absolute recovery rate with p < 0.01 statistical significance.',
        'Average recovery latency reduced from 4.1 hours to 48 minutes.',
        'Zero spam reports registered across WhatsApp nudge deliveries.',
      ],
    },
  });

  // 7. Audit Log Seed
  console.log('Seeding Initial Audit Logs...');
  await prisma.auditLog.createMany({
    data: [
      {
        merchantId: merchantSaaSify.id,
        actorType: 'MERCHANT_ADMIN',
        actorName: 'Ujjwal (Merchant Admin)',
        action: 'APPROVE_RECOVERY',
        entityType: 'TRANSACTION',
        entityId: 'txn_saas_002',
        details: 'Approved payment link generation for ₹42,000 enterprise subscription.',
        integrityHash: 'sha256:7f9b8c0e2a4d5671190bcdae5412891f',
        timestamp: new Date(Date.now() - 3600000 * 12),
      },
      {
        merchantId: merchantSaaSify.id,
        actorType: 'POLICY_ENGINE',
        actorName: 'RecoverIQ Guardrails',
        action: 'SUPPRESS_RECOVERY',
        entityType: 'TRANSACTION',
        entityId: 'txn_saas_005',
        details: 'Suppressed automated recovery due to high customer dispute risk (68% vs 60% ceiling).',
        integrityHash: 'sha256:3a8d4e912bc5671239abcef109283401',
        timestamp: new Date(Date.now() - 3600000 * 8),
      },
    ],
  });

  console.log('✅ RecoverIQ database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during database seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
