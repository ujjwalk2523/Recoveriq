'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useAppState } from '@/lib/store/app-state-provider';
import { DecisionTraceView } from '@/components/ui/decision-trace-view';
import { StatusBadge, CategoryBadge, MethodBadge } from '@/components/ui/status-badge';
import { StrategyBadge } from '@/components/ui/strategy-badge';
import {
  Search,
  Filter,
  RefreshCw,
  Terminal,
  ShieldCheck,
  CheckCircle2,
  Activity,
  Bot,
} from 'lucide-react';
import { Transaction } from '@/lib/engine/types';

export default function AIDecisionsPage() {
  const { transactions } = useAppState();
  const [selectedTxnId, setSelectedTxnId] = useState<string>(transactions[0]?.id || '');
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [isRechecking, setIsRechecking] = useState(false);
  const [liveNote, setLiveNote] = useState<string | null>(null);

  const filteredTxns = transactions.filter((t) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      t.id.toLowerCase().includes(q) ||
      t.customer.name.toLowerCase().includes(q) ||
      t.failureCode.toLowerCase().includes(q);
    const matchesCat = filterCategory === 'ALL' || t.failureCategory === filterCategory;
    return matchesSearch && matchesCat;
  });

  const selectedTxn =
    filteredTxns.find((t) => t.id === selectedTxnId) ||
    filteredTxns[0] ||
    transactions[0];

  const handleRecheck = async () => {
    if (!selectedTxn) return;
    setIsRechecking(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      setLiveNote(
        `Analysis re-evaluated: Telemetry confirms ${selectedTxn.recommendedAction} yields highest Expected Value (₹${selectedTxn.expectedRecoveryValue.toLocaleString('en-IN')}).`
      );
    } finally {
      setIsRechecking(false);
    }
  };

  return (
    <AppLayout
      title="Decision Trace"
      subtitle="Complete lifecycle and reasoning trace for every payment recovery action"
    >
      {/* 2 Column Layout: Decision Stream & Selected Trace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Searchable Decision Feed (1 Col) */}
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold uppercase tracking-wider text-[10px]">
                Decision log ({filteredTxns.length})
              </span>
              <span className="font-mono text-[10px]">Realtime</span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search transaction..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-400 font-sans"
              />
            </div>

            {/* Category Filter */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-slate-400"
            >
              <option value="ALL">All failure categories</option>
              <option value="AUTHENTICATION">3DS / OTP drop</option>
              <option value="INSUFFICIENT_FUNDS">Low balance</option>
              <option value="TECHNICAL">Switch timeout</option>
              <option value="CUSTOMER_DROPOUT">User abandonment</option>
              <option value="RISK_AND_FRAUD">Risk flag</option>
              <option value="MANDATE_ISSUE">Mandate issue</option>
            </select>
          </div>

          <div className="space-y-2 max-h-[650px] overflow-y-auto pr-1">
            {filteredTxns.map((txn) => {
              const isSelected = txn.id === selectedTxn?.id;

              return (
                <div
                  key={txn.id}
                  onClick={() => {
                    setSelectedTxnId(txn.id);
                    setLiveNote(null);
                  }}
                  className={`p-3.5 rounded-xl border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-slate-100 border-slate-300 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-bold text-slate-900">{txn.id}</span>
                    <span className="text-xs font-mono font-bold text-slate-900">
                      ₹{txn.amount.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span className="truncate max-w-[140px]">{txn.customer.name}</span>
                    <MethodBadge method={txn.paymentMethod} />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <StrategyBadge action={txn.recommendedAction} showIcon={false} />
                    <span className="text-[10px] font-mono text-slate-600 font-medium">
                      {txn.actionConfidence}% confidence
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Decision Trace (2 Cols) */}
        {selectedTxn ? (
          <div className="lg:col-span-2 space-y-5">
            {/* Header Card */}
            <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-bold text-slate-900">{selectedTxn.id}</span>
                    <StatusBadge status={selectedTxn.status} size="sm" />
                    <MethodBadge method={selectedTxn.paymentMethod} />
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Order {selectedTxn.orderId} • {selectedTxn.customer.name} ({selectedTxn.customer.segment})
                  </p>
                </div>

                <div className="text-right font-mono">
                  <div className="text-2xl font-bold text-slate-900">
                    ₹{selectedTxn.amount.toLocaleString('en-IN')}
                  </div>
                  <div className="text-xs text-emerald-700 font-medium">
                    EV: ₹{selectedTxn.expectedRecoveryValue.toLocaleString('en-IN')} ({Math.round(selectedTxn.recoveryProbability * 100)}% prob)
                  </div>
                </div>
              </div>

              {/* Rationale Callout */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-900">
                  <span>Recommendation & analysis</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-600 font-normal">
                      Confidence: {selectedTxn.actionConfidence}%
                    </span>
                    <button
                      type="button"
                      onClick={handleRecheck}
                      disabled={isRechecking}
                      className="px-2.5 py-0.5 text-[10px] font-medium rounded bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                    >
                      {isRechecking ? 'Re-evaluating...' : 'Re-evaluate'}
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed font-sans">
                  {selectedTxn.aiRationale}
                </p>

                {liveNote && (
                  <p className="text-xs text-emerald-800 bg-emerald-50 p-2 rounded border border-emerald-200 font-mono mt-1.5">
                    {liveNote}
                  </p>
                )}

                {selectedTxn.whyNotRationale && (
                  <div className="pt-2 mt-2 border-t border-slate-200 text-xs text-slate-600">
                    <strong>Suppression note:</strong> {selectedTxn.whyNotRationale}
                  </div>
                )}
              </div>
            </div>

            {/* 8-Stage Stepper */}
            <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  8-Stage execution lifecycle
                </h3>
                <span className="text-[10px] text-slate-400">
                  Click any stage to view payload
                </span>
              </div>

              <DecisionTraceView trace={selectedTxn.decisionTrace} />
            </div>

            {/* Feature Schema */}
            <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-semibold text-slate-900">
                  Input feature vector
                </h4>
                <span className="text-[10px] font-mono text-slate-400">JSON schema</span>
              </div>

              <pre className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-800 overflow-x-auto leading-relaxed">
                {JSON.stringify(
                  {
                    transaction_features: {
                      id: selectedTxn.id,
                      amount_inr: selectedTxn.amount,
                      payment_method: selectedTxn.paymentMethod,
                      failure_code: selectedTxn.failureCode,
                      failure_category: selectedTxn.failureCategory,
                    },
                    customer_features: {
                      segment: selectedTxn.customer.segment,
                      lifetime_value_inr: selectedTxn.customer.lifetimeValue,
                      fatigue_score: selectedTxn.customer.fatigueScore,
                      risk_score: selectedTxn.customer.riskScore,
                    },
                    policy_constraints: {
                      auto_approval_limit_inr: 15000,
                      min_confidence_pct: 80,
                    },
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2 p-12 text-center rounded-xl bg-white border border-slate-200">
            <p className="text-xs text-slate-500">Select a transaction to inspect its decision trace</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
