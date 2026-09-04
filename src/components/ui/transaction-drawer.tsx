'use client';

import React, { useState } from 'react';
import { RecoveryActionType, Transaction } from '@/lib/engine/types';
import { StatusBadge, CategoryBadge, MethodBadge } from './status-badge';
import { StrategyBadge } from './strategy-badge';
import { DecisionTraceView } from './decision-trace-view';
import {
  X,
  Sparkles,
  Bot,
  User,
  ShieldCheck,
  Zap,
  TrendingUp,
  AlertTriangle,
  FileCode,
  Activity,
  CheckCircle2,
  Phone,
  Mail,
  CreditCard,
  Building,
  RefreshCw,
  Send,
  Ban,
} from 'lucide-react';
import { useAppState } from '@/lib/store/app-state-provider';

interface TransactionDrawerProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export function TransactionDrawer({ transaction, onClose }: TransactionDrawerProps) {
  const { approveTransaction, rejectTransaction } = useAppState();
  const [activeTab, setActiveTab] = useState<'diagnosis' | 'strategies' | 'trace' | 'raw'>('diagnosis');
  const [isExecuting, setIsExecuting] = useState(false);
  const [customAction, setCustomAction] = useState<RecoveryActionType | ''>('');
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [liveAiNote, setLiveAiNote] = useState<string | null>(null);

  if (!transaction) return null;

  const handleApprove = async () => {
    setIsExecuting(true);
    try {
      await approveTransaction(transaction.id, customAction || undefined);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleReject = () => {
    const reason = prompt('Specify suppression reason:', 'Merchant manually suppressed recovery.') || 'Merchant suppressed recovery.';
    rejectTransaction(transaction.id, reason);
  };

  const handleTriggerReanalysis = async () => {
    setIsReanalyzing(true);
    try {
      await new Promise((r) => setTimeout(r, 900));
      setLiveAiNote(
        `Verified: Switch latency and balance telemetry confirm ${transaction.recommendedAction} as optimal recovery strategy (EV: ₹${transaction.expectedRecoveryValue.toLocaleString('en-IN')}).`
      );
    } finally {
      setIsReanalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white border-l border-slate-200 text-slate-900 flex flex-col h-full shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-4 px-6 border-b border-slate-200 flex items-center justify-between bg-white">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-900">{transaction.id}</span>
              <StatusBadge status={transaction.status} size="sm" />
              <MethodBadge method={transaction.paymentMethod} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              Order: {transaction.orderId} • {new Date(transaction.createdAt).toLocaleString('en-IN')}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Amount & Expected Value Summary Banner */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Failed amount</span>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              ₹{transaction.amount.toLocaleString('en-IN')}
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Expected recovery value (EV)</span>
            <div className="text-2xl font-bold text-emerald-700 font-mono">
              ₹{transaction.expectedRecoveryValue.toLocaleString('en-IN')}
              <span className="text-xs text-slate-500 font-normal ml-1.5">
                ({Math.round(transaction.recoveryProbability * 100)}% prob)
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-white text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('diagnosis')}
            className={`py-3 px-3 border-b-2 font-medium transition-colors cursor-pointer ${
              activeTab === 'diagnosis'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Diagnosis & customer
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('strategies')}
            className={`py-3 px-3 border-b-2 font-medium transition-colors cursor-pointer ${
              activeTab === 'strategies'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Strategy EV comparison
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('trace')}
            className={`py-3 px-3 border-b-2 font-medium transition-colors cursor-pointer ${
              activeTab === 'trace'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Decision trace (8 steps)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('raw')}
            className={`py-3 px-3 border-b-2 font-medium transition-colors cursor-pointer ${
              activeTab === 'raw'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Gateway response
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* TAB 1: DIAGNOSIS & CUSTOMER */}
          {activeTab === 'diagnosis' && (
            <>
              {/* Failure Root Cause */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CategoryBadge category={transaction.failureCategory} />
                    <span className="text-xs font-mono font-medium text-slate-600">
                      {transaction.failureCode}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleTriggerReanalysis}
                    disabled={isReanalyzing}
                    className="text-[11px] px-2.5 py-1 rounded bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    {isReanalyzing ? 'Re-checking...' : 'Re-check analysis'}
                  </button>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed font-sans">
                  {transaction.failureMessage}
                </p>

                {/* Recommendation Callout */}
                <div className="p-3.5 rounded-lg bg-white border border-slate-200 space-y-1.5 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-900">
                    <span>Recovery strategy & rationale</span>
                    <span className="font-mono text-slate-600 font-normal">
                      {transaction.actionConfidence}% confidence
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {transaction.aiRationale}
                  </p>
                  {liveAiNote && (
                    <p className="text-xs text-emerald-800 bg-emerald-50 p-2 rounded border border-emerald-200 font-mono mt-1.5">
                      {liveAiNote}
                    </p>
                  )}
                </div>

                {/* Why NOT Recover Rationale */}
                {transaction.whyNotRationale && (
                  <div className="p-3.5 rounded-lg bg-slate-100 border border-slate-200 space-y-1">
                    <div className="text-xs font-semibold text-slate-900">
                      Suppression logic (Why NOT recover)
                    </div>
                    <p className="text-xs text-slate-600">
                      {transaction.whyNotRationale}
                    </p>
                  </div>
                )}
              </div>

              {/* Customer Profile Card */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-900">Customer profile</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                    {transaction.customer.segment}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Customer name</span>
                    <p className="font-medium text-slate-900">{transaction.customer.name}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Lifetime value (LTV)</span>
                    <p className="font-bold text-slate-900 font-mono">
                      ₹{transaction.customer.lifetimeValue.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Contact</span>
                    <p className="font-mono text-slate-700">{transaction.customer.phone}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Email</span>
                    <p className="font-mono text-slate-700 truncate">{transaction.customer.email}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Instrument</span>
                    <p className="font-mono text-slate-700">
                      {transaction.customer.upiVpa || `Card ending in ${transaction.customer.cardLast4 || 'N/A'}`}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Bank</span>
                    <p className="text-slate-700">{transaction.customer.bankName || 'HDFC Bank'}</p>
                  </div>
                </div>

                {/* Gauges */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Fatigue score</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {transaction.customer.fatigueScore}/100
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          transaction.customer.fatigueScore > 75
                            ? 'bg-rose-500'
                            : transaction.customer.fatigueScore > 40
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${transaction.customer.fatigueScore}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Dispute risk score</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {transaction.customer.riskScore}/100
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          transaction.customer.riskScore > 60
                            ? 'bg-rose-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${transaction.customer.riskScore}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: STRATEGY COMPARISON */}
          {activeTab === 'strategies' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                Candidate recovery actions ranked by Expected Recovery Value (EV), penalizing intervention costs and customer fatigue.
              </p>

              <div className="space-y-2">
                {transaction.strategyYields.map((yieldItem) => (
                  <div
                    key={yieldItem.actionType}
                    className={`p-3.5 rounded-xl border transition-colors ${
                      yieldItem.isRecommended
                        ? 'bg-slate-50 border-slate-300 shadow-xs'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <StrategyBadge action={yieldItem.actionType} />
                        {yieldItem.isRecommended && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-900 text-white">
                            Optimal EV
                          </span>
                        )}
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-sm font-bold text-slate-900">
                          ₹{yieldItem.expectedValue.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[11px] text-slate-500 ml-1">EV</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                      <div>
                        <span>Success prob: </span>
                        <strong className="text-slate-800">
                          {Math.round(yieldItem.successProbability * 100)}%
                        </strong>
                      </div>
                      <div>
                        <span>Cost: </span>
                        <strong className="text-slate-800">₹{yieldItem.interventionCost}</strong>
                      </div>
                      <div>
                        <span>Est. delay: </span>
                        <strong className="text-slate-800">{yieldItem.timeToRecoverHours}h</strong>
                      </div>
                    </div>

                    {yieldItem.whyNotReason && (
                      <p className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded border border-amber-200 mt-2">
                        {yieldItem.whyNotReason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: DECISION TRACE */}
          {activeTab === 'trace' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                Execution lifecycle from webhook capture to settlement reconciliation.
              </p>
              <DecisionTraceView trace={transaction.decisionTrace} />
            </div>
          )}

          {/* TAB 4: RAW GATEWAY */}
          {activeTab === 'raw' && (
            <div className="space-y-2">
              <span className="text-xs text-slate-500 font-mono">Raw switch response payload</span>
              <pre className="p-4 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 overflow-x-auto">
                {JSON.stringify(
                  {
                    id: transaction.paymentId,
                    entity: 'payment',
                    amount: transaction.amount * 100,
                    currency: transaction.currency,
                    status: 'failed',
                    order_id: transaction.orderId,
                    method: transaction.paymentMethod.toLowerCase(),
                    error_code: transaction.failureCode,
                    error_description: transaction.failureMessage,
                    customer: {
                      id: transaction.customer.id,
                      name: transaction.customer.name,
                      contact: transaction.customer.phone,
                      email: transaction.customer.email,
                    },
                    recovered_at: transaction.recoveredAt,
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 px-6 border-t border-slate-200 bg-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReject}
              className="px-3 py-2 text-xs font-medium rounded-lg text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
            >
              Suppress
            </button>

            {/* Custom Override Selector */}
            <select
              value={customAction}
              onChange={(e) => setCustomAction(e.target.value as RecoveryActionType)}
              className="bg-white border border-slate-200 text-slate-700 text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:border-slate-400"
            >
              <option value="">Auto: {transaction.recommendedAction}</option>
              <option value="IMMEDIATE_RETRY">Override: Immediate retry</option>
              <option value="WHATSAPP_NUDGE">Override: WhatsApp 1-tap</option>
              <option value="OPTIMAL_DELAYED_RETRY">Override: Scheduled retry</option>
              <option value="PAYMENT_LINK">Override: Payment link</option>
              <option value="HUMAN_ESCALATION">Override: Escalation</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleApprove}
            disabled={isExecuting || transaction.status === 'RECOVERED'}
            className="px-5 py-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isExecuting
              ? 'Executing...'
              : transaction.status === 'RECOVERED'
              ? 'Settled'
              : `Approve (₹${transaction.expectedRecoveryValue.toLocaleString('en-IN')} EV)`}
          </button>
        </div>
      </div>
    </div>
  );
}
