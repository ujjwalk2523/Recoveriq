import { resolveOptimalStrategy, STRATEGY_CATALOG } from '../src/lib/engine/strategy-definition';
import { RecoveryOrchestrator } from '../src/lib/engine/sequence-orchestrator';
import { SequenceTransitionEngine } from '../src/lib/engine/sequence-transitions';
import { SequenceTraceExplainer } from '../src/lib/engine/sequence-trace';
import { DEFAULT_POLICY_GUARDRAILS, evaluatePolicyGuardrails } from '../src/lib/engine/policy-guardrails';

async function runPhase4Tests() {
  console.log('===========================================================');
  console.log('🚀 RUNNING PHASE 4 — DECISION & RECOVERY SEQUENCE ENGINE TEST SUITE');
  console.log('===========================================================\n');

  // ---------------------------------------------------------------------------
  // 4.1 Strategy Definition & Catalog
  // ---------------------------------------------------------------------------
  console.log('▶ Test 4.1: Formal Strategy Definition & Blueprinting');
  const techStrategy = resolveOptimalStrategy({
    failureCategory: 'TECHNICAL',
    amount: 5000,
    customerSegment: 'CONSUMER',
  });
  console.log(`  [TECHNICAL] Selected Strategy: ${techStrategy.name} (${techStrategy.id})`);
  console.log(`  [TECHNICAL] Blueprint Steps: ${techStrategy.defaultSteps.length}`);
  console.log(`    Step 1: ${techStrategy.defaultSteps[0]?.actionType} (delay: ${techStrategy.defaultSteps[0]?.delayMinutes}m)`);
  console.log(`    Step 2: ${techStrategy.defaultSteps[1]?.actionType} (delay: ${techStrategy.defaultSteps[1]?.delayMinutes}m)`);
  console.log(`    Step 3: ${techStrategy.defaultSteps[2]?.actionType} (delay: ${techStrategy.defaultSteps[2]?.delayMinutes}m)`);

  const lowBalStrategy = resolveOptimalStrategy({
    failureCategory: 'INSUFFICIENT_FUNDS',
    amount: 8000,
    customerSegment: 'CONSUMER',
  });
  console.log(`  [INSUFFICIENT_FUNDS] Selected Strategy: ${lowBalStrategy.name}`);

  const vipStrategy = resolveOptimalStrategy({
    failureCategory: 'TECHNICAL',
    amount: 45000,
    customerSegment: 'VIP',
  });
  console.log(`  [VIP High-Ticket] Selected Strategy: ${vipStrategy.name}`);

  const fraudStrategy = resolveOptimalStrategy({
    failureCategory: 'RISK_AND_FRAUD',
    amount: 15000,
    isFraudOrHotlisted: true,
  });
  console.log(`  [FRAUD] Selected Strategy: ${fraudStrategy.name}`);

  if (
    techStrategy.id !== 'STRAT_TECH_RAPID_CASCADE' ||
    lowBalStrategy.id !== 'STRAT_LOW_BALANCE_PAYDAY' ||
    vipStrategy.id !== 'STRAT_HIGH_TICKET_VIP_CONCIERGE' ||
    fraudStrategy.id !== 'STRAT_FRAUD_HARD_SUPPRESSION'
  ) {
    throw new Error('Strategy catalog resolution failed!');
  }
  console.log('  ✔ Strategy catalog resolution and blueprint definitions verified.');

  // ---------------------------------------------------------------------------
  // 4.2 Sequence Compilation & Auto-Approval Dispatch
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 4.2: Sequence Compilation & Auto-Approved Dispatch');
  const mockCustomer = {
    id: 'cust_kartik_sharma',
    name: 'Kartik Sharma',
    email: 'kartik@example.in',
    phone: '+919876543210',
    segment: 'CONSUMER' as const,
    lifetimeValue: 25000,
    totalTransactions: 6,
    pastRecoveries: 2,
    fatigueScore: 12,
    riskScore: 8,
  };

  const policyCheckAuto = evaluatePolicyGuardrails(
    14500,
    'IMMEDIATE_RETRY',
    90,
    mockCustomer,
    DEFAULT_POLICY_GUARDRAILS
  );

  const seq1 = await RecoveryOrchestrator.startSequence({
    transactionId: 'txn_seq_test_1',
    merchantId: 'mer_saasify_blr',
    failureCategory: 'TECHNICAL',
    customer: mockCustomer,
    amount: 14500,
    policyCheck: policyCheckAuto,
    isAutoApproved: true,
  });

  console.log(`  Sequence ID: ${seq1.id}`);
  console.log(`  Strategy: ${seq1.strategyName}`);
  console.log(`  Initial Status: ${seq1.status}`);
  console.log(`  Current Step Pointer: Step ${seq1.steps[seq1.currentStepIndex]?.stepNumber} (${seq1.steps[seq1.currentStepIndex]?.actionType})`);
  console.log(`  Step 1 Status: ${seq1.steps[0]?.status}`);

  if (seq1.status !== 'ACTIVE' || seq1.steps[0]?.status !== 'DISPATCHED') {
    throw new Error('Sequence auto-approval initiation failed!');
  }
  console.log('  ✔ Sequence compiled and Step 1 dispatched successfully.');

  // ---------------------------------------------------------------------------
  // 4.3 Conditional Transitions: Full Multi-Step Cascade Simulation
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 4.3: Simulating Multi-Step Sequence Cascade & Stop Condition');
  // Step 1 fails: Zero-delay retry fails with NPCI timeout
  console.log('  Triggering Outcome: Step 1 ATTEMPT_FAILED...');
  const step1OutcomeResult = await RecoveryOrchestrator.handleStepOutcome({
    transactionId: 'txn_seq_test_1',
    stepNumber: 1,
    outcome: {
      eventType: 'ATTEMPT_FAILED',
      errorMessage: 'NPCI UPI switch response timeout (504)',
      timestamp: new Date().toISOString(),
    },
    customerFatigueScore: 15,
  });

  const seqAfterStep1 = step1OutcomeResult.sequence;
  console.log(`  Current Step after Step 1 failure: Step ${seqAfterStep1.steps[seqAfterStep1.currentStepIndex]?.stepNumber} (${seqAfterStep1.steps[seqAfterStep1.currentStepIndex]?.actionType})`);
  console.log(`  Transition Explanation: ${seqAfterStep1.transitionHistory[seqAfterStep1.transitionHistory.length - 1]?.explanation}`);

  if (seqAfterStep1.currentStepIndex !== 1 || seqAfterStep1.steps[1]?.status !== 'DISPATCHED') {
    throw new Error('Conditional transition failed to advance to Step 2!');
  }
  console.log('  ✔ Step 1 FAILED -> Advanced to Step 2 (Delayed Retry).');

  // Step 2 fails: Delayed retry fails with bank server maintenance
  console.log('\n  Triggering Outcome: Step 2 ATTEMPT_FAILED...');
  const step2OutcomeResult = await RecoveryOrchestrator.handleStepOutcome({
    transactionId: 'txn_seq_test_1',
    stepNumber: 2,
    outcome: {
      eventType: 'ATTEMPT_FAILED',
      errorMessage: 'Bank server maintenance',
      timestamp: new Date().toISOString(),
    },
    customerFatigueScore: 22,
  });

  const seqAfterStep2 = step2OutcomeResult.sequence;
  console.log(`  Current Step after Step 2 failure: Step ${seqAfterStep2.steps[seqAfterStep2.currentStepIndex]?.stepNumber} (${seqAfterStep2.steps[seqAfterStep2.currentStepIndex]?.actionType})`);

  if (seqAfterStep2.currentStepIndex !== 2 || seqAfterStep2.steps[2]?.status !== 'DISPATCHED') {
    throw new Error('Conditional transition failed to advance to Step 3!');
  }
  console.log('  ✔ Step 2 FAILED -> Advanced to Step 3 (Payment Link).');

  // Step 3 in-flight: Customer opens payment link
  console.log('\n  Triggering Outcome: Step 3 LINK_OPENED...');
  const linkOpenedResult = await RecoveryOrchestrator.handleStepOutcome({
    transactionId: 'txn_seq_test_1',
    stepNumber: 3,
    outcome: {
      eventType: 'LINK_OPENED',
      timestamp: new Date().toISOString(),
    },
    customerFatigueScore: 22,
  });
  console.log(`  Sequence Status after Link Opened: ${linkOpenedResult.sequence.status}`);
  console.log(`  Explanation: ${linkOpenedResult.sequence.transitionHistory[linkOpenedResult.sequence.transitionHistory.length - 1]?.explanation}`);

  // Step 3 captured: Customer pays ₹14,500 via UPI link
  console.log('\n  Triggering Outcome: Step 3 PAYMENT_CAPTURED...');
  const paymentCapturedResult = await RecoveryOrchestrator.handleStepOutcome({
    transactionId: 'txn_seq_test_1',
    stepNumber: 3,
    outcome: {
      eventType: 'PAYMENT_CAPTURED',
      amount: 14500,
      gatewayPaymentId: 'pay_recovered_998123',
      timestamp: new Date().toISOString(),
    },
    customerFatigueScore: 22,
  });

  const finalSeq = paymentCapturedResult.sequence;
  console.log(`  Final Sequence Status: ${finalSeq.status}`);
  console.log(`  Stop Condition: ${finalSeq.stopCondition}`);
  console.log(`  Stop Reason: ${finalSeq.stopReason}`);

  if (finalSeq.status !== 'COMPLETED' || finalSeq.stopCondition !== 'PAID') {
    throw new Error('Payment captured failed to complete sequence!');
  }
  console.log('  ✔ Step 3 PAID -> Sequence COMPLETED (Stop Condition: PAID).');

  // ---------------------------------------------------------------------------
  // 4.4 Fatigue Engine Boundary Halt
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 4.4: Fatigue Engine Boundary Halt');
  const fatiguedCustomer = {
    ...mockCustomer,
    fatigueScore: 78, // Exceeds ceiling 70
  };

  const seqFatigued = await RecoveryOrchestrator.startSequence({
    transactionId: 'txn_seq_fatigue_test',
    merchantId: 'mer_saasify_blr',
    failureCategory: 'INSUFFICIENT_FUNDS',
    customer: fatiguedCustomer,
    amount: 5000,
    policyCheck: policyCheckAuto,
    isAutoApproved: true,
  });

  const fatigueResult = await RecoveryOrchestrator.handleStepOutcome({
    transactionId: 'txn_seq_fatigue_test',
    stepNumber: 1,
    outcome: {
      eventType: 'FATIGUE_EXCEEDED',
      errorMessage: 'Customer fatigue ceiling exceeded (78/100)',
      timestamp: new Date().toISOString(),
    },
    customerFatigueScore: 78,
    maxFatigueThreshold: 70,
  });

  console.log(`  Fatigued Sequence Status: ${fatigueResult.sequence.status}`);
  console.log(`  Stop Condition: ${fatigueResult.sequence.stopCondition}`);
  console.log(`  Explanation: ${fatigueResult.sequence.transitionHistory[fatigueResult.sequence.transitionHistory.length - 1]?.explanation}`);

  if (fatigueResult.sequence.status !== 'HALTED' || fatigueResult.sequence.stopCondition !== 'FATIGUE_EXCEEDED') {
    throw new Error('Fatigue halt test failed!');
  }
  console.log('  ✔ Fatigue threshold boundary halt verified.');

  // ---------------------------------------------------------------------------
  // 4.5 Human Approval Workflow Integration (AWAITING_APPROVAL -> APPROVE / REJECT)
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 4.5: Human Approval Sequence Workflow (Awaiting -> Approve -> Reject)');
  // 1. High value transaction needs approval
  const vipCustomer = { ...mockCustomer, segment: 'VIP' as const };
  const policyCheckManual = evaluatePolicyGuardrails(
    85000, // ₹85,000 high ticket
    'PAYMENT_LINK',
    75,
    vipCustomer,
    DEFAULT_POLICY_GUARDRAILS
  );

  const seqAwaiting = await RecoveryOrchestrator.startSequence({
    transactionId: 'txn_seq_vip_approval_test',
    merchantId: 'mer_saasify_blr',
    failureCategory: 'TECHNICAL',
    customer: vipCustomer,
    amount: 85000,
    policyCheck: policyCheckManual,
    isAutoApproved: false, // Pauses in AWAITING_APPROVAL
  });

  console.log(`  High-Ticket Sequence Status: ${seqAwaiting.status}`);
  if (seqAwaiting.status !== 'AWAITING_APPROVAL') {
    throw new Error('Sequence failed to pause in AWAITING_APPROVAL state');
  }
  console.log('  ✔ Sequence correctly paused in AWAITING_APPROVAL.');

  // 2. Operator approves
  console.log('  Simulating Operator Approval...');
  const approvedSeq = await RecoveryOrchestrator.handleOperatorApproval({
    transactionId: 'txn_seq_vip_approval_test',
    approvedBy: 'Neha Nair (Chief Risk Officer)',
  });

  console.log(`  Sequence Status after Approval: ${approvedSeq.status}`);
  console.log(`  Step 1 Status after Approval: ${approvedSeq.steps[0]?.status}`);

  if (approvedSeq.status !== 'ACTIVE' || approvedSeq.steps[0]?.status !== 'DISPATCHED') {
    throw new Error('Operator approval failed to resume sequence and dispatch Step 1!');
  }
  console.log('  ✔ Operator approved -> Sequence resumed to ACTIVE and Step 1 dispatched.');

  // 3. Testing Operator Rejection on a second high-risk transaction
  const seqToReject = await RecoveryOrchestrator.startSequence({
    transactionId: 'txn_seq_rejected_test',
    merchantId: 'mer_saasify_blr',
    failureCategory: 'TECHNICAL',
    customer: vipCustomer,
    amount: 85000,
    policyCheck: policyCheckManual,
    isAutoApproved: false,
  });

  console.log('  Simulating Operator Rejection...');
  const rejectedSeq = await RecoveryOrchestrator.handleOperatorRejection({
    transactionId: 'txn_seq_rejected_test',
    rejectedBy: 'Neha Nair (Chief Risk Officer)',
    reason: 'Suspicious overseas IP address mismatch; manual outreach via offline relationship manager instead.',
  });

  console.log(`  Sequence Status after Rejection: ${rejectedSeq.status}`);
  console.log(`  Stop Condition: ${rejectedSeq.stopCondition}`);
  console.log(`  Stop Reason: ${rejectedSeq.stopReason}`);

  if (rejectedSeq.status !== 'HALTED' || rejectedSeq.stopCondition !== 'OPERATOR_REJECTED') {
    throw new Error('Operator rejection failed to halt sequence with OPERATOR_REJECTED condition!');
  }
  console.log('  ✔ Operator rejected -> Sequence HALTED with OPERATOR_REJECTED condition.');

  // ---------------------------------------------------------------------------
  // 4.6 Explainable Decision Trace Audit Story
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 4.6: Decision Trace Audit Story Generation');
  const auditStory = SequenceTraceExplainer.generateFullAuditStory(finalSeq);
  console.log('  Full Sequence Audit Story:');
  for (const line of auditStory) {
    console.log(`    ${line}`);
  }

  if (auditStory.length < 3) {
    throw new Error('Audit story failed to record full transition narrative');
  }
  console.log('  ✔ Explainable decision trace narrative verified.');

  console.log('\n🎉 ALL PHASE 4 SEQUENCE ENGINE TESTS PASSED WITH 100% SUCCESS!');
  console.log('===========================================================');
}

runPhase4Tests().catch(err => {
  console.error('❌ Phase 4 test failed:', err);
  process.exit(1);
});
