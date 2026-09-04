'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  AuditLogEntry,
  MerchantOverview,
  PolicyGuardrails,
  RecoveryActionType,
  RecoveryExperiment,
  SimulatorParams,
  SimulatorResult,
  Transaction,
} from '../engine/types';
import {
  DEFAULT_SIMULATOR_PARAMS,
  runRecoverySimulation,
} from '../engine/simulator-engine';
import { DEFAULT_POLICY_GUARDRAILS } from '../engine/policy-guardrails';
import {
  generateInitialTransactions,
  INITIAL_AUDIT_LOGS,
  INITIAL_EXPERIMENTS,
  INITIAL_MERCHANT,
} from '../data/mock-dataset';
import { razorpayService } from '../engine/razorpay-service';

interface AppStateContextType {
  isDemoMode: boolean;
  setIsDemoMode: (val: boolean) => void;
  geminiApiKey: string;
  setGeminiApiKey: (key: string) => void;
  razorpayKeyId: string;
  setRazorpayKeyId: (key: string) => void;
  
  // Data
  merchant: MerchantOverview;
  transactions: Transaction[];
  policies: PolicyGuardrails;
  simulatorParams: SimulatorParams;
  simulationResults: SimulatorResult[];
  experiments: RecoveryExperiment[];
  auditLogs: AuditLogEntry[];
  
  // Actions
  approveTransaction: (id: string, customAction?: RecoveryActionType) => Promise<void>;
  rejectTransaction: (id: string, reason: string) => void;
  batchApproveTransactions: (ids: string[]) => Promise<void>;
  executeManualRetry: (id: string, action: RecoveryActionType) => Promise<void>;
  updatePolicies: (updated: Partial<PolicyGuardrails>) => void;
  updateSimulatorParams: (updated: Partial<SimulatorParams>) => void;
  simulateIncomingWebhook: (mockTxn?: Partial<Transaction>) => void;
  resetToDefaultData: () => void;
  refreshFromBackend: () => Promise<void>;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [razorpayKeyId, setRazorpayKeyId] = useState<string>('rzp_test_recoveriq_demo');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [policies, setPolicies] = useState<PolicyGuardrails>(DEFAULT_POLICY_GUARDRAILS);
  const [simulatorParams, setSimulatorParams] = useState<SimulatorParams>(DEFAULT_SIMULATOR_PARAMS);
  const [experiments, setExperiments] = useState<RecoveryExperiment[]>(INITIAL_EXPERIMENTS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Function to sync live data from backend service layer
  const refreshFromBackend = async () => {
    try {
      const [txnsRes, merchantRes, auditRes] = await Promise.all([
        fetch('/api/transactions'),
        fetch('/api/merchants/me'),
        fetch('/api/audit-logs'),
      ]);

      if (txnsRes.ok) {
        const tData = await txnsRes.json();
        if (tData.transactions && Array.isArray(tData.transactions) && tData.transactions.length > 0) {
          setTransactions(tData.transactions);
        }
      }

      if (merchantRes.ok) {
        const mData = await merchantRes.json();
        if (mData.policies) {
          setPolicies(mData.policies);
        }
      }

      if (auditRes.ok) {
        const aData = await auditRes.json();
        if (aData.auditLogs && Array.isArray(aData.auditLogs) && aData.auditLogs.length > 0) {
          setAuditLogs(aData.auditLogs);
        }
      }
    } catch (err) {
      console.warn('[AppState] Backend sync failed, keeping current data:', err);
    }
  };

  // Load from local storage and sync with backend API
  useEffect(() => {
    try {
      const savedTxns = localStorage.getItem('rcvq_transactions');
      const savedPolicies = localStorage.getItem('rcvq_policies');
      const savedParams = localStorage.getItem('rcvq_sim_params');
      const savedLogs = localStorage.getItem('rcvq_audit_logs');
      const savedGemini = localStorage.getItem('rcvq_gemini_key');
      const savedRzp = localStorage.getItem('rcvq_rzp_key');

      if (savedTxns) {
        setTransactions(JSON.parse(savedTxns));
      } else {
        setTransactions(generateInitialTransactions());
      }

      if (savedPolicies) setPolicies(JSON.parse(savedPolicies));
      if (savedParams) setSimulatorParams(JSON.parse(savedParams));
      if (savedLogs) setAuditLogs(JSON.parse(savedLogs));
      if (savedGemini) setGeminiApiKey(savedGemini);
      if (savedRzp) setRazorpayKeyId(savedRzp);
    } catch {
      setTransactions(generateInitialTransactions());
    } finally {
      setIsLoaded(true);
      // Attempt background synchronization with backend APIs
      refreshFromBackend();
    }
  }, []);

  // Save changes to local storage
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem('rcvq_transactions', JSON.stringify(transactions));
      localStorage.setItem('rcvq_policies', JSON.stringify(policies));
      localStorage.setItem('rcvq_sim_params', JSON.stringify(simulatorParams));
      localStorage.setItem('rcvq_audit_logs', JSON.stringify(auditLogs));
      localStorage.setItem('rcvq_gemini_key', geminiApiKey);
      localStorage.setItem('rcvq_rzp_key', razorpayKeyId);
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }, [transactions, policies, simulatorParams, auditLogs, geminiApiKey, razorpayKeyId, isLoaded]);

  // Recalculate merchant stats dynamically based on current transactions
  const merchant: MerchantOverview = useMemo(() => {
    if (transactions.length === 0) return INITIAL_MERCHANT;

    const failedOrRecovering = transactions.filter(t => t.status === 'NEEDS_APPROVAL' || t.status === 'RECOVERING' || t.status === 'FAILED');
    const recovered = transactions.filter(t => t.status === 'RECOVERED');
    const suppressed = transactions.filter(t => t.status === 'SUPPRESSED');

    const totalFailedSum = transactions.reduce((acc, t) => acc + t.amount, 0);
    const recoveredSum = recovered.reduce((acc, t) => acc + (t.recoveredAmount || t.amount), 0);
    const atRiskSum = failedOrRecovering.reduce((acc, t) => acc + t.amount, 0);
    const potentialSum = failedOrRecovering.reduce((acc, t) => acc + t.expectedRecoveryValue, 0);
    const avoidedLossSum = suppressed.reduce((acc, t) => acc + (t.amount > 10000 ? 1500 : 500), 0) + 412000;

    const recoveryRate = totalFailedSum > 0 ? Math.round((recoveredSum / totalFailedSum) * 1000) / 10 : 72.4;

    return {
      ...INITIAL_MERCHANT,
      revenueAtRiskINR: atRiskSum,
      potentialRecoveryINR: potentialSum,
      recoveredRevenueINR: recoveredSum,
      recoveryRatePercent: recoveryRate,
      avoidedLossINR: avoidedLossSum,
      activeOpportunitiesCount: failedOrRecovering.length,
      pendingApprovalCount: transactions.filter(t => t.status === 'NEEDS_APPROVAL').length,
    };
  }, [transactions]);

  // Run simulation dynamically
  const simulationResults: SimulatorResult[] = useMemo(() => {
    return runRecoverySimulation(transactions, simulatorParams);
  }, [transactions, simulatorParams]);

  // Helper to log audit entries
  const appendAuditLog = (
    actorType: AuditLogEntry['actorType'],
    actorName: string,
    action: string,
    entityType: AuditLogEntry['entityType'],
    entityId: string,
    details: string
  ) => {
    const newEntry: AuditLogEntry = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      actorType,
      actorName,
      action,
      entityType,
      entityId,
      details,
      integrityHash: `sha256:${Math.random().toString(36).substring(2, 16)}`,
    };
    setAuditLogs(prev => [newEntry, ...prev]);
  };

  // Action: Single Approve (Connected to Backend API)
  const approveTransaction = async (id: string, customAction?: RecoveryActionType) => {
    const txn = transactions.find(t => t.id === id);
    if (!txn) return;

    const actionToRun = customAction || txn.recommendedAction;

    // Call backend API in parallel
    try {
      fetch(`/api/transactions/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionType: actionToRun }),
      }).catch(e => console.warn('Backend approve call background error:', e));
    } catch {
      // ignore
    }

    const execution = await razorpayService.executeRecoveryAction({
      transactionId: txn.id,
      actionType: actionToRun,
      amount: txn.amount,
      customerPhone: txn.customer.phone,
    });

    const isRecoveredNow = execution.status === 'CAPTURED';
    const newStatus = isRecoveredNow ? 'RECOVERED' : 'RECOVERING';

    setTransactions(prev =>
      prev.map(t => {
        if (t.id !== id) return t;

        const updatedTrace = t.decisionTrace.map(step => {
          if (step.step === 6) {
            return {
              ...step,
              status: 'COMPLETED' as const,
              summary: `Approved by Merchant Admin for ${actionToRun}.`,
            };
          }
          if (step.step === 7) {
            return {
              ...step,
              status: 'COMPLETED' as const,
              summary: execution.message,
            };
          }
          if (step.step === 8 && isRecoveredNow) {
            return {
              ...step,
              status: 'COMPLETED' as const,
              summary: `₹${t.amount.toLocaleString('en-IN')} successfully recovered via ${execution.channel}.`,
            };
          }
          return step;
        });

        return {
          ...t,
          status: newStatus,
          requiresApproval: false,
          approvedBy: 'Merchant Admin',
          approvedAt: new Date().toISOString(),
          recommendedAction: actionToRun,
          executionStatus: isRecoveredNow ? 'SUCCEEDED' : 'DISPATCHED',
          recoveredAt: isRecoveredNow ? new Date().toISOString() : undefined,
          recoveredAmount: isRecoveredNow ? t.amount : undefined,
          decisionTrace: updatedTrace,
        };
      })
    );

    appendAuditLog(
      'MERCHANT_ADMIN',
      'Merchant Admin (ujjwal@saasify.in)',
      'APPROVE_RECOVERY',
      'TRANSACTION',
      id,
      `Approved recovery action ${actionToRun} for ₹${txn.amount.toLocaleString('en-IN')}. ${execution.message}`
    );

    if (isRecoveredNow) {
      try {
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } });
      } catch {
        // ignore
      }
    }
  };

  // Action: Reject / Suppress (Connected to Backend API)
  const rejectTransaction = (id: string, reason: string) => {
    try {
      fetch(`/api/transactions/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      }).catch(e => console.warn('Backend reject call background error:', e));
    } catch {
      // ignore
    }

    setTransactions(prev =>
      prev.map(t => {
        if (t.id !== id) return t;
        const updatedTrace = t.decisionTrace.map(step => {
          if (step.step === 6) {
            return {
              ...step,
              status: 'SKIPPED' as const,
              summary: `Rejected by Merchant: ${reason}`,
            };
          }
          if (step.step === 7) {
            return {
              ...step,
              status: 'SKIPPED' as const,
              summary: 'Recovery action skipped by merchant decision.',
            };
          }
          return step;
        });
        return {
          ...t,
          status: 'SUPPRESSED',
          requiresApproval: false,
          whyNotRationale: reason,
          decisionTrace: updatedTrace,
        };
      })
    );

    appendAuditLog(
      'MERCHANT_ADMIN',
      'Merchant Admin (ujjwal@saasify.in)',
      'REJECT_RECOVERY',
      'TRANSACTION',
      id,
      `Rejected recovery opportunity: ${reason}`
    );
  };

  // Action: Batch Approve
  const batchApproveTransactions = async (ids: string[]) => {
    for (const id of ids) {
      await approveTransaction(id);
    }
    try {
      confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 } });
    } catch {
      // ignore
    }
  };

  // Action: Execute Manual Retry
  const executeManualRetry = async (id: string, action: RecoveryActionType) => {
    await approveTransaction(id, action);
  };

  // Action: Update Policies (Connected to Backend API)
  const updatePolicies = (updated: Partial<PolicyGuardrails>) => {
    setPolicies(prev => ({ ...prev, ...updated }));
    try {
      fetch('/api/merchants/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      }).catch(e => console.warn('Backend policy update background error:', e));
    } catch {
      // ignore
    }
    appendAuditLog(
      'MERCHANT_ADMIN',
      'Merchant Admin (ujjwal@saasify.in)',
      'UPDATE_POLICY',
      'POLICY',
      'pol_saasify_001',
      `Updated policy guardrails: ${Object.keys(updated).join(', ')}`
    );
  };

  // Action: Update Simulator Parameters
  const updateSimulatorParams = (updated: Partial<SimulatorParams>) => {
    setSimulatorParams(prev => ({ ...prev, ...updated }));
  };

  // Action: Simulate Incoming Webhook
  const simulateIncomingWebhook = (mockTxn?: Partial<Transaction>) => {
    const defaultNewTxn: Transaction = {
      id: `txn_live_${Date.now()}`,
      merchantId: 'mer_saasify_blr',
      merchantName: 'SaaSify Technologies India Pvt Ltd',
      orderId: `order_in_${Math.floor(100000 + Math.random() * 900000)}`,
      paymentId: `pay_rzp_${Math.random().toString(36).substring(2, 10)}`,
      amount: Math.floor(2000 + Math.random() * 18000),
      currency: 'INR',
      paymentMethod: 'UPI',
      status: 'NEEDS_APPROVAL',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      failureCode: 'INSUFFICIENT_FUNDS_OR_LIMIT',
      failureMessage: 'Payment declined due to bank daily limit on UPI debit',
      failureCategory: 'INSUFFICIENT_FUNDS',
      customer: {
        id: `cust_${Math.random().toString(36).substring(2, 6)}`,
        name: 'Arjun Venkatesh',
        email: 'arjun.v@innovatetech.in',
        phone: '+91 99801 77312',
        segment: 'ENTERPRISE',
        lifetimeValue: 145000,
        totalTransactions: 12,
        pastRecoveries: 2,
        fatigueScore: 24,
        riskScore: 11,
        upiVpa: 'arjunv@oksbi',
        bankName: 'State Bank of India',
      },
      recoveryProbability: 0.81,
      expectedRecoveryValue: 11200,
      recommendedAction: 'OPTIMAL_DELAYED_RETRY',
      actionConfidence: 86,
      aiRationale: 'UPI daily debit cap reached. Historical clearance occurs within 6 hours. Delayed retry projected at 81% success.',
      evBreakdown: {
        expectedValue: 11200,
        successProbability: 0.81,
        grossPotential: 12500,
        interventionCost: 15,
        fatiguePenaltyCost: 20,
        netEV: 11200,
        confidenceScore: 86,
      },
      strategyYields: [],
      requiresApproval: true,
      approvalReason: 'Enterprise Segment & Amount threshold requires sign-off',
      decisionTrace: [
        {
          step: 1,
          name: 'DETECT',
          timestamp: new Date().toISOString(),
          status: 'COMPLETED',
          summary: 'Incoming webhook: payment.failed captured from Razorpay.',
          details: { gateway: 'Razorpay', event: 'payment.failed' },
        },
        {
          step: 2,
          name: 'DIAGNOSE',
          timestamp: new Date().toISOString(),
          status: 'COMPLETED',
          summary: 'Classified failure: INSUFFICIENT_FUNDS (Temporary Bank Limit)',
          details: {},
        },
        {
          step: 3,
          name: 'PREDICT',
          timestamp: new Date().toISOString(),
          status: 'COMPLETED',
          summary: '81% recovery probability predicted based on historical UPI limit resets.',
          details: {},
        },
        {
          step: 4,
          name: 'SIMULATE',
          timestamp: new Date().toISOString(),
          status: 'COMPLETED',
          summary: 'Net EV calculated: ₹11,200',
          details: {},
        },
        {
          step: 5,
          name: 'OPTIMIZE',
          timestamp: new Date().toISOString(),
          status: 'COMPLETED',
          summary: 'Recommended Action: OPTIMAL_DELAYED_RETRY (Confidence 86%)',
          details: {},
        },
        {
          step: 6,
          name: 'APPROVE',
          timestamp: new Date().toISOString(),
          status: 'AWAITING_APPROVAL',
          summary: 'Guardrail trigger: Enterprise Tier transaction requires manual approval.',
          details: {},
        },
        {
          step: 7,
          name: 'EXECUTE',
          timestamp: new Date().toISOString(),
          status: 'AWAITING_APPROVAL',
          summary: 'Awaiting operator sign-off before dispatching retry.',
          details: {},
        },
        {
          step: 8,
          name: 'MEASURE',
          timestamp: new Date().toISOString(),
          status: 'IN_PROGRESS',
          summary: 'Pending recovery resolution.',
          details: {},
        },
      ],
    };

    const finalTxn = { ...defaultNewTxn, ...mockTxn } as Transaction;
    setTransactions(prev => [finalTxn, ...prev]);

    appendAuditLog(
      'GATEWAY_WEBHOOK',
      'Razorpay Ingestion Engine',
      'CAPTURE_FAILURE',
      'TRANSACTION',
      finalTxn.id,
      `Captured failed payment of ₹${finalTxn.amount.toLocaleString('en-IN')} for ${finalTxn.customer.name}`
    );
  };

  // Action: Reset
  const resetToDefaultData = () => {
    localStorage.clear();
    setTransactions(generateInitialTransactions());
    setPolicies(DEFAULT_POLICY_GUARDRAILS);
    setSimulatorParams(DEFAULT_SIMULATOR_PARAMS);
    setExperiments(INITIAL_EXPERIMENTS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
  };

  return (
    <AppStateContext.Provider
      value={{
        isDemoMode,
        setIsDemoMode,
        geminiApiKey,
        setGeminiApiKey,
        razorpayKeyId,
        setRazorpayKeyId,
        merchant,
        transactions,
        policies,
        simulatorParams,
        simulationResults,
        experiments,
        auditLogs,
        approveTransaction,
        rejectTransaction,
        batchApproveTransactions,
        executeManualRetry,
        updatePolicies,
        updateSimulatorParams,
        simulateIncomingWebhook,
        resetToDefaultData,
        refreshFromBackend,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
}
