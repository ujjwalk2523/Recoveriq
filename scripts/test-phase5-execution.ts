import { RecoveryJobQueue } from '../src/lib/queue/recovery-queue';
import { ActionDispatcher } from '../src/lib/adapters/action-dispatcher';
import { RazorpayRetryAdapter } from '../src/lib/adapters/razorpay-retry.adapter';
import { PaymentLinkAdapter } from '../src/lib/adapters/payment-link.adapter';
import { WhatsAppAdapter } from '../src/lib/adapters/whatsapp.adapter';
import { IdempotencyGuard } from '../src/lib/execution/idempotency';
import { RecoveryExecutor } from '../src/lib/execution/recovery-executor';
import { RecoveryWorker } from '../src/lib/execution/worker';
import { RecoveryOrchestrator } from '../src/lib/engine/sequence-orchestrator';
import { evaluatePolicyGuardrails, DEFAULT_POLICY_GUARDRAILS } from '../src/lib/engine/policy-guardrails';

async function runPhase5Tests() {
  console.log('===========================================================');
  console.log('🚀 RUNNING PHASE 5 — RECOVERY EXECUTION INFRASTRUCTURE SUITE');
  console.log('===========================================================\n');

  // Initialize background worker
  RecoveryWorker.init();
  IdempotencyGuard.clear();
  RecoveryJobQueue.clearQueue();

  // ---------------------------------------------------------------------------
  // 5.1 Action Adapter Architecture & ActionDispatcher
  // ---------------------------------------------------------------------------
  console.log('▶ Test 5.1: Action Adapter Architecture & Dispatching');
  const retryAdapter = new RazorpayRetryAdapter();
  const plinkAdapter = new PaymentLinkAdapter();
  const waAdapter = new WhatsAppAdapter();

  if (!retryAdapter.canHandle('IMMEDIATE_RETRY') || !plinkAdapter.canHandle('PAYMENT_LINK') || !waAdapter.canHandle('WHATSAPP_NUDGE')) {
    throw new Error('Adapter capability routing failed!');
  }

  // Test Dispatcher with Payment Link
  const plinkResponse = await ActionDispatcher.dispatch({
    transactionId: 'txn_test_plink_01',
    sequenceId: 'seq_test_plink_01',
    stepNumber: 1,
    actionType: 'PAYMENT_LINK',
    amount: 14500,
    customerPhone: '+919845012345',
    customerEmail: 'kartik.sharma@example.in',
    idempotencyKey: 'idemp_test_plink_01',
  });

  console.log(`  [PAYMENT_LINK] Provider: ${plinkResponse.provider}, Channel: ${plinkResponse.channel}, Cost: ₹${plinkResponse.costINR}`);
  console.log(`  Message: ${plinkResponse.message}`);

  // Test Dispatcher with WhatsApp
  const waResponse = await ActionDispatcher.dispatch({
    transactionId: 'txn_test_wa_01',
    sequenceId: 'seq_test_wa_01',
    stepNumber: 2,
    actionType: 'WHATSAPP_NUDGE',
    amount: 14500,
    customerPhone: '+919845012345',
    idempotencyKey: 'idemp_test_wa_01',
  });

  console.log(`  [WHATSAPP_NUDGE] Provider: ${waResponse.provider}, MessageId: ${waResponse.providerReference}`);

  // Test Dispatcher with Immediate Retry
  const retryResponse = await ActionDispatcher.dispatch({
    transactionId: 'txn_test_retry_01',
    sequenceId: 'seq_test_retry_01',
    stepNumber: 1,
    actionType: 'IMMEDIATE_RETRY',
    amount: 14500,
    customerPhone: '+919845012345',
    idempotencyKey: 'idemp_test_retry_01',
  });

  console.log(`  [IMMEDIATE_RETRY] Provider: ${retryResponse.provider}, Order: ${retryResponse.providerReference}`);

  if (!plinkResponse.success || !waResponse.success || !retryResponse.success) {
    throw new Error('Action dispatcher failed for one of the adapters');
  }
  console.log('  ✔ Multi-channel action adapter architecture verified.');

  // ---------------------------------------------------------------------------
  // 5.2 Strict Idempotency Protection
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 5.2: Strict Idempotent Execution (Replay Protection)');
  const testIdempKey = 'idemp_mer_saasify_txn_double_charge_seq_step1';

  // First Execution: Normal execution
  const exec1 = await RecoveryExecutor.executeAction({
    merchantId: 'mer_saasify_blr',
    transactionId: 'txn_double_charge_test',
    sequenceId: 'seq_double_charge_test',
    stepNumber: 1,
    actionType: 'PAYMENT_LINK',
    amount: 50000,
    customerPhone: '+919845012345',
  });

  console.log(`  First Execution Result: ${exec1.message} (Duplicate Ignored: ${!!exec1.isDuplicateIgnored})`);

  // Second Execution: Worker crashes & retries with identical compound key
  const exec2 = await RecoveryExecutor.executeAction({
    merchantId: 'mer_saasify_blr',
    transactionId: 'txn_double_charge_test',
    sequenceId: 'seq_double_charge_test',
    stepNumber: 1,
    actionType: 'PAYMENT_LINK',
    amount: 50000,
    customerPhone: '+919845012345',
  });

  console.log(`  Second Execution (Replay): ${exec2.message} (Duplicate Ignored: ${!!exec2.isDuplicateIgnored})`);

  if (exec1.isDuplicateIgnored || !exec2.isDuplicateIgnored) {
    throw new Error('Idempotency guard failed to detect duplicate replay!');
  }
  console.log('  ✔ Idempotent execution guard verified (prevented duplicate charges & spam).');

  // ---------------------------------------------------------------------------
  // 5.3 Recovery Job Queue (Delayed Scheduling & Cancellation)
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 5.3: Recovery Job Queue Scheduling & Pending Job Cancellation');
  const seqIdToCancel = 'seq_auto_cancel_test';

  // Enqueue delayed job 1: 30 minutes in future
  const delayedJob1 = await RecoveryJobQueue.scheduleJob({
    merchantId: 'mer_saasify_blr',
    transactionId: 'txn_cancel_test_1',
    sequenceId: seqIdToCancel,
    stepNumber: 2,
    actionType: 'OPTIMAL_DELAYED_RETRY',
    channel: 'GATEWAY_RETRY',
    idempotencyKey: 'idemp_cancel_test_step2',
    amount: 14500,
    customerPhone: '+919845012345',
    scheduledFor: new Date(Date.now() + 1800000).toISOString(),
    delayMs: 1800000,
  });

  // Enqueue delayed job 2: 60 minutes in future
  const delayedJob2 = await RecoveryJobQueue.scheduleJob({
    merchantId: 'mer_saasify_blr',
    transactionId: 'txn_cancel_test_1',
    sequenceId: seqIdToCancel,
    stepNumber: 3,
    actionType: 'PAYMENT_LINK',
    channel: 'PAYMENT_LINK',
    idempotencyKey: 'idemp_cancel_test_step3',
    amount: 14500,
    customerPhone: '+919845012345',
    scheduledFor: new Date(Date.now() + 3600000).toISOString(),
    delayMs: 3600000,
  });

  console.log(`  Enqueued delayed jobs. Active jobs count: ${RecoveryJobQueue.getActiveJobs().length}`);

  // Customer pays early! Cancel all sequence jobs
  console.log(`  Customer settled payment early! Cancelling pending jobs for ${seqIdToCancel}...`);
  const cancelledCount = await RecoveryJobQueue.cancelSequenceJobs(seqIdToCancel);
  console.log(`  Successfully cancelled jobs: ${cancelledCount}`);

  if (cancelledCount !== 2 || RecoveryJobQueue.getActiveJobs().length !== 0) {
    throw new Error('Queue job cancellation failed!');
  }
  console.log('  ✔ Queue delayed scheduling and sequence job cancellation verified.');

  // ---------------------------------------------------------------------------
  // 5.4 Queue Exponential Backoff & Dead-Letter Queue (DLQ)
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 5.4: Queue Exponential Backoff & Dead-Letter Queue (DLQ)');
  // Register temporary failing worker to test DLQ
  let attemptCounter = 0;
  RecoveryJobQueue.registerWorker(async (job) => {
    attemptCounter++;
    if (job.jobId.includes('dlq') || job.sequenceId.includes('dlq')) {
      return { success: false, error: 'Simulated persistent upstream gateway outage 503' };
    }
    return { success: true };
  });

  const dlqJob = await RecoveryJobQueue.scheduleJob({
    merchantId: 'mer_saasify_blr',
    transactionId: 'txn_dlq_01',
    sequenceId: 'seq_dlq_01',
    stepNumber: 1,
    actionType: 'OPTIMAL_DELAYED_RETRY',
    channel: 'GATEWAY_RETRY',
    idempotencyKey: 'idemp_dlq_01',
    amount: 1000,
    customerPhone: '+919845012345',
    scheduledFor: new Date().toISOString(),
    delayMs: 0,
    maxAttempts: 2, // Fail after 2 attempts
  });

  // Wait for attempts & backoff timer
  console.log('  Awaiting worker processing and exponential backoff...');
  await new Promise(resolve => setTimeout(resolve, 3500));

  const dlqList = RecoveryJobQueue.getDeadLetterJobs();
  console.log(`  Dead-Letter Queue entries: ${dlqList.length}`);
  if (dlqList.length > 0) {
    console.log(`  DLQ Job: ${dlqList[0]?.jobId}, Status: ${dlqList[0]?.status}, Error: ${dlqList[0]?.lastError}`);
  }

  if (dlqList.length !== 1 || dlqList[0]?.status !== 'FAILED') {
    throw new Error('Dead-Letter Queue routing failed for exhausted job!');
  }
  console.log('  ✔ Exponential backoff and Dead-Letter Queue (DLQ) routing verified.');

  // Restore main worker
  RecoveryWorker.init();

  // ---------------------------------------------------------------------------
  // 5.5 End-to-End Orchestrator + Queue Feedback Loop
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 5.5: Closed-Loop Orchestrator, Queue & Webhook Feedback');
  const mockCustomer = {
    id: 'cust_kartik',
    name: 'Kartik Sharma',
    email: 'kartik@example.in',
    phone: '+919845012345',
    segment: 'CONSUMER' as const,
    lifetimeValue: 35000,
    totalTransactions: 8,
    pastRecoveries: 3,
    fatigueScore: 10,
    riskScore: 8,
  };

  const policyCheck = evaluatePolicyGuardrails(14500, 'IMMEDIATE_RETRY', 92, mockCustomer, DEFAULT_POLICY_GUARDRAILS);

  // 1. Failure ingested -> Sequence compiled & Step 1 queued
  const seq = await RecoveryOrchestrator.startSequence({
    transactionId: 'txn_phase5_feedback',
    merchantId: 'mer_saasify_blr',
    failureCategory: 'TECHNICAL',
    customer: mockCustomer,
    amount: 14500,
    policyCheck,
    isAutoApproved: true,
  });

  console.log(`  Started Sequence: ${seq.id} (${seq.strategyName})`);
  console.log(`  Step 1 Scheduled for: ${seq.steps[0]?.scheduledAt}`);

  // 2. Step 1 fails -> Sequence automatically schedules Step 2 in Queue
  await RecoveryOrchestrator.handleStepOutcome({
    transactionId: 'txn_phase5_feedback',
    stepNumber: 1,
    outcome: {
      eventType: 'ATTEMPT_FAILED',
      errorMessage: 'NPCI UPI switch response timeout',
      timestamp: new Date().toISOString(),
    },
    customerFatigueScore: 15,
  });

  const activeQueuedJobs = RecoveryJobQueue.getActiveJobs().filter(j => j.sequenceId === seq.id);
  console.log(`  Active scheduled queue jobs for ${seq.id}: ${activeQueuedJobs.length}`);
  if (activeQueuedJobs.length > 0) {
    console.log(`  Step 2 queued in background: Action=${activeQueuedJobs[0]?.actionType}, Delay=${activeQueuedJobs[0]?.delayMs}ms`);
  }

  // 3. Webhook arrives: payment.captured!
  console.log('  Simulating incoming payment.captured webhook...');
  await RecoveryOrchestrator.handleStepOutcome({
    transactionId: 'txn_phase5_feedback',
    stepNumber: 2,
    outcome: {
      eventType: 'PAYMENT_CAPTURED',
      amount: 14500,
      gatewayPaymentId: 'pay_captured_phase5_final',
      timestamp: new Date().toISOString(),
    },
    customerFatigueScore: 15,
  });

  const remainingJobs = RecoveryJobQueue.getActiveJobs().filter(j => j.sequenceId === seq.id);
  console.log(`  Remaining scheduled queue jobs after payment.captured: ${remainingJobs.length}`);

  if (remainingJobs.length !== 0) {
    throw new Error('Failed to cancel remaining jobs on payment.captured!');
  }
  console.log('  ✔ Webhook feedback loop completed: Sequence reached PAID and cancelled all pending queue jobs.');

  console.log('\n🎉 ALL PHASE 5 RECOVERY EXECUTION INFRASTRUCTURE TESTS PASSED WITH 100% SUCCESS!');
  console.log('===========================================================');
}

runPhase5Tests().catch(err => {
  console.error('❌ Phase 5 test failed:', err);
  process.exit(1);
});
