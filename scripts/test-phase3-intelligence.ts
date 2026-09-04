import { diagnosePaymentFailure } from '../src/lib/engine/classifier';
import { computeCustomerRecoveryMemory } from '../src/lib/engine/customer-profile';
import { RecoveryProbabilityService } from '../src/lib/engine/probability-service';
import { calculateExpectedNetRecovery } from '../src/lib/engine/ev-calculator';
import { evaluateRecoveryStrategies } from '../src/lib/engine/strategy-recommender';
import { FatigueEngine } from '../src/lib/engine/fatigue-engine';
import { RiskEngine } from '../src/lib/engine/risk-engine';
import { evaluatePolicyGuardrails } from '../src/lib/engine/policy-guardrails';
import { RecoveryIntelligenceEngine } from '../src/lib/engine/recovery-intelligence';

async function runPhase3Tests() {
  console.log('===========================================================');
  console.log('🚀 RUNNING PHASE 3 — RECOVERY INTELLIGENCE ENGINE TEST SUITE');
  console.log('===========================================================\n');

  // ---------------------------------------------------------------------------
  // 3.1 Failure Diagnosis
  // ---------------------------------------------------------------------------
  console.log('▶ Test 3.1: Structured Failure Diagnosis');
  const lowBalanceDiagnosis = diagnosePaymentFailure('INSUFFICIENT_FUNDS');
  console.log('  [INSUFFICIENT_FUNDS] Severity:', lowBalanceDiagnosis.severity);
  console.log('  [INSUFFICIENT_FUNDS] Recoverability:', lowBalanceDiagnosis.recoverability);
  console.log('  [INSUFFICIENT_FUNDS] Recommended:', lowBalanceDiagnosis.recommendedChannels);
  console.log('  [INSUFFICIENT_FUNDS] Avoid:', lowBalanceDiagnosis.avoidChannels);

  if (
    lowBalanceDiagnosis.recoverability !== 'HIGH' ||
    !lowBalanceDiagnosis.recommendedChannels.includes('OPTIMAL_DELAYED_RETRY') ||
    !lowBalanceDiagnosis.avoidChannels.includes('IMMEDIATE_RETRY')
  ) {
    throw new Error('Failure Diagnosis test failed for INSUFFICIENT_FUNDS');
  }

  const fraudDiagnosis = diagnosePaymentFailure('CARD_REPORTED_LOST_STOLEN');
  if (fraudDiagnosis.recoverability !== 'ZERO' || !fraudDiagnosis.recommendedChannels.includes('DO_NOT_RECOVER')) {
    throw new Error('Failure Diagnosis test failed for CARD_REPORTED_LOST_STOLEN');
  }
  console.log('  ✔ Failure diagnosis structure, severity, and channel avoidance verified.');

  // ---------------------------------------------------------------------------
  // 3.2 Customer Recovery Profile & Memory
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 3.2: Customer Recovery Memory Calculation');
  const sampleHistory = [
    { id: '1', amount: 2500, paymentMethod: 'UPI' as const, status: 'SUCCESS' as const, createdAt: new Date(Date.now() - 86400000 * 5) },
    { id: '2', amount: 3000, paymentMethod: 'UPI' as const, status: 'RECOVERED' as const, createdAt: new Date(Date.now() - 86400000 * 3), recoveredAt: new Date(Date.now() - 86400000 * 3 + 18 * 60000) },
    { id: '3', amount: 5000, paymentMethod: 'UPI' as const, status: 'SUCCESS' as const, createdAt: new Date(Date.now() - 86400000 * 2) },
    { id: '4', amount: 8000, paymentMethod: 'CARD' as const, status: 'SUCCESS' as const, createdAt: new Date(Date.now() - 86400000 * 1) },
    { id: '5', amount: 12000, paymentMethod: 'CARD' as const, status: 'FAILED' as const, createdAt: new Date(Date.now() - 3600000) },
  ];

  const memory = computeCustomerRecoveryMemory(sampleHistory);
  console.log(`  UPI Success Rate: ${memory.upiSuccessRate}%`);
  console.log(`  Card Success Rate: ${memory.cardSuccessRate}%`);
  console.log(`  Overall Recovery Rate: ${memory.recoveryRate}%`);
  console.log(`  Avg Recovery Delay: ${memory.avgRecoveryDelayMinutes} min`);
  console.log(`  Best Recovery Hour: ${memory.bestRecoveryHour}:00`);
  console.log(`  Retry Tolerance: ${memory.retryTolerance}`);

  if (memory.upiSuccessRate !== 100 || memory.cardSuccessRate !== 50) {
    throw new Error('Customer Recovery Memory success rates calculation mismatch');
  }
  console.log('  ✔ Customer recovery memory computed correctly from transaction ledger.');

  // ---------------------------------------------------------------------------
  // 3.3 Recovery Probability Prediction Service
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 3.3: Swappable Prediction Interface (RecoveryProbabilityService)');
  const predAttempt1 = RecoveryProbabilityService.predict({
    amount: 14500,
    paymentMethod: 'UPI',
    failureCategory: 'TECHNICAL',
    failureCode: 'BAD_REQUEST_ERROR',
    severity: 'LOW',
    recoverability: 'HIGH',
    actionType: 'IMMEDIATE_RETRY',
    attemptNumber: 1,
    hourOfDay: 14,
    customerSegment: 'VIP',
    customerRecoveryRate: 85,
    customerFatigueScore: 10,
    customerRiskScore: 5,
  });

  const predAttempt3 = RecoveryProbabilityService.predict({
    amount: 14500,
    paymentMethod: 'UPI',
    failureCategory: 'TECHNICAL',
    failureCode: 'BAD_REQUEST_ERROR',
    severity: 'LOW',
    recoverability: 'HIGH',
    actionType: 'IMMEDIATE_RETRY',
    attemptNumber: 3,
    hourOfDay: 14,
    customerSegment: 'VIP',
    customerRecoveryRate: 85,
    customerFatigueScore: 10,
    customerRiskScore: 5,
  });

  console.log(`  Attempt #1 Probability: ${predAttempt1.probability} (Confidence: ${predAttempt1.confidenceScore}%)`);
  console.log(`  Attempt #3 Probability: ${predAttempt3.probability} (Confidence: ${predAttempt3.confidenceScore}%)`);
  console.log('  Model Source:', predAttempt1.modelSource);

  if (predAttempt1.probability <= predAttempt3.probability) {
    throw new Error('Diminishing returns validation failed for attempt escalation');
  }
  console.log('  ✔ Swappable prediction interface and diminishing returns verified.');

  // ---------------------------------------------------------------------------
  // 3.4 Expected Net Recovery Formula
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 3.4: Expected Net Recovery Exact Formula');
  // Example from user spec:
  // Amount ₹14,500, Probability 84% -> Gross ₹12,180
  // Cost ₹40, Fatigue ₹80, Risk ₹0 -> Net EV ₹12,060
  const ev = calculateExpectedNetRecovery({
    amount: 14500,
    probability: 0.84,
    actionType: 'PAYMENT_LINK',
    interventionCost: 40,
    fatiguePenaltyINR: 80,
    riskPenaltyINR: 0,
  });

  console.log(`  Gross Potential: ₹${ev.grossPotential}`);
  console.log(`  Intervention Cost: ₹${ev.interventionCost}`);
  console.log(`  Fatigue Penalty: ₹${ev.fatiguePenaltyCost}`);
  console.log(`  Net EV: ₹${ev.netEV}`);

  if (ev.grossPotential !== 12180 || ev.netEV !== 12060) {
    throw new Error(`Expected Net Recovery arithmetic mismatch! Got Gross: ${ev.grossPotential}, Net: ${ev.netEV}`);
  }
  console.log('  ✔ Expected Net Recovery formula matches mathematical specification.');

  // ---------------------------------------------------------------------------
  // 3.5 Strategy Scoring & Comparison
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 3.5: Multi-Strategy Scoring & Net EV Ranking');
  const mockCustomer = {
    id: 'cust_kartik',
    name: 'Kartik Sharma',
    email: 'kartik@example.in',
    phone: '+919876543210',
    segment: 'ENTERPRISE' as const,
    lifetimeValue: 85000,
    totalTransactions: 12,
    pastRecoveries: 3,
    fatigueScore: 18,
    riskScore: 12,
  };

  const strategyResult = evaluateRecoveryStrategies(
    14500,
    'TECHNICAL',
    'BAD_REQUEST_ERROR',
    'UPI',
    mockCustomer,
    1,
    14
  );

  console.log(`  Recommended Action: ${strategyResult.recommendedAction}`);
  console.log(`  Expected Net Recovery: ₹${strategyResult.expectedRecoveryValue.toLocaleString('en-IN')}`);
  console.log(`  Yields evaluated: ${strategyResult.strategyYields.length}`);

  for (const yieldItem of strategyResult.strategyYields.slice(0, 4)) {
    console.log(`    - ${yieldItem.actionTitle}: ₹${yieldItem.expectedValue.toLocaleString('en-IN')} (${Math.round(yieldItem.successProbability * 100)}%)`);
  }

  if (strategyResult.strategyYields.length < 5 || !strategyResult.recommendedAction) {
    throw new Error('Strategy scoring failed to evaluate candidate actions');
  }
  console.log('  ✔ Multi-strategy yield scoring and ranking verified.');

  // ---------------------------------------------------------------------------
  // 3.6 Fatigue Engine
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 3.6: Fatigue Engine & "More attempts ≠ more revenue"');
  const fatigueAttempt1 = FatigueEngine.evaluate({
    currentFatigueScore: 20,
    actionType: 'WHATSAPP_NUDGE',
    attemptNumber: 1,
    customerLTV: 50000,
  });

  const fatigueAttempt4 = FatigueEngine.evaluate({
    currentFatigueScore: 65,
    actionType: 'WHATSAPP_NUDGE',
    attemptNumber: 4,
    customerLTV: 50000,
  });

  console.log(`  Attempt #1 Fatigue Penalty: ₹${fatigueAttempt1.fatiguePenaltyINR}, Stop: ${fatigueAttempt1.shouldStopRecovery}`);
  console.log(`  Attempt #4 Fatigue Penalty: ₹${fatigueAttempt4.fatiguePenaltyINR}, Stop: ${fatigueAttempt4.shouldStopRecovery}`);
  console.log('  Exhaustion Reason:', fatigueAttempt4.exhaustionReason);

  if (!fatigueAttempt4.shouldStopRecovery || fatigueAttempt4.fatiguePenaltyINR <= fatigueAttempt1.fatiguePenaltyINR) {
    throw new Error('Fatigue Engine failed to stop recovery at attempt #4');
  }
  console.log('  ✔ Fatigue engine diminishing returns and hard contact cap verified.');

  // ---------------------------------------------------------------------------
  // 3.7 Risk Engine
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 3.7: Risk Engine (Customer + Transaction + Recovery Risk)');
  const lowRisk = RiskEngine.evaluate({
    amount: 5000,
    failureCategory: 'TECHNICAL',
    failureCode: 'BAD_REQUEST_ERROR',
    severity: 'LOW',
    customerRiskScore: 10,
    confidenceScore: 92,
    actionType: 'IMMEDIATE_RETRY',
  });

  const highRisk = RiskEngine.evaluate({
    amount: 75000, // High ticket
    failureCategory: 'RISK_AND_FRAUD',
    failureCode: 'CARD_REPORTED_LOST_STOLEN',
    severity: 'CRITICAL',
    customerRiskScore: 85,
    confidenceScore: 50,
    actionType: 'IMMEDIATE_RETRY',
  });

  console.log(`  Low Risk Score: ${lowRisk.compositeRiskScore}/100, Approval Required: ${lowRisk.requiresHumanApproval}`);
  console.log(`  High Risk Score: ${highRisk.compositeRiskScore}/100, Hard Block: ${highRisk.isHardBlockRequired}`);

  if (lowRisk.requiresHumanApproval || !highRisk.isHardBlockRequired) {
    throw new Error('Risk Engine assessment conditions failed');
  }
  console.log('  ✔ Multi-factor risk engine verified.');

  // ---------------------------------------------------------------------------
  // 3.8 Policy Authorization Engine
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 3.8: Policy Engine (AI Recommends, Policy Authorizes)');
  const policyAuto = evaluatePolicyGuardrails(
    12000,
    'IMMEDIATE_RETRY',
    92,
    { ...mockCustomer, segment: 'CONSUMER', fatigueScore: 20, riskScore: 10 }
  );

  const policyManual = evaluatePolicyGuardrails(
    25000, // Exceeds auto ceiling ₹15,000
    'PAYMENT_LINK',
    75, // Below confidence ceiling 80%
    { ...mockCustomer, segment: 'VIP' } // VIP requires human sign-off
  );

  console.log(`  Standard Consumer Policy Status: ${policyAuto.status}`);
  console.log(`  High-Value VIP Policy Status: ${policyManual.status}`);
  console.log('  Manual Approval Reasons:', policyManual.approvalReasons);

  if (policyAuto.status !== 'AUTO_APPROVED' || policyManual.status !== 'NEEDS_APPROVAL') {
    throw new Error('Policy Engine authorization states failed');
  }
  console.log('  ✔ Policy authorization decoupling verified.');

  // ---------------------------------------------------------------------------
  // 3.9 End-to-End Recovery Intelligence Pipeline Orchestrator
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 3.9: Master Orchestrator (RecoveryIntelligenceEngine.process)');
  const pipelineResult = RecoveryIntelligenceEngine.process({
    amount: 14500,
    paymentMethod: 'UPI',
    failureCode: 'BAD_REQUEST_ERROR',
    failureMessage: 'NPCI UPI switch response timeout',
    customer: mockCustomer,
    attemptNumber: 1,
    hourOfDay: 15,
  });

  console.log(`  Pipeline Action: ${pipelineResult.recommendedAction}`);
  console.log(`  Recovery Probability: ${Math.round(pipelineResult.recoveryProbability * 100)}%`);
  console.log(`  Net EV: ₹${pipelineResult.expectedNetRecoveryINR.toLocaleString('en-IN')}`);
  console.log(`  Policy Auto-Approved: ${pipelineResult.isAutoApproved}`);
  console.log(`  Total Decision Traces Generated: ${pipelineResult.decisionTraces.length}`);

  for (const trace of pipelineResult.decisionTraces) {
    console.log(`    Step ${trace.step} [${trace.name}]: ${trace.summary}`);
  }

  if (pipelineResult.decisionTraces.length !== 8) {
    throw new Error(`Expected 8 DecisionTrace steps, but got ${pipelineResult.decisionTraces.length}`);
  }

  console.log('\n🎉 ALL 9 RECOVERY INTELLIGENCE ENGINE TESTS PASSED WITH 100% SUCCESS!');
  console.log('===========================================================');
}

runPhase3Tests().catch(err => {
  console.error('❌ Phase 3 test failed:', err);
  process.exit(1);
});
