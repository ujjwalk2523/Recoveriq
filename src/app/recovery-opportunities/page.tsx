'use client';

import React, { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useAppState } from '@/lib/store/app-state-provider';
import { Transaction } from '@/lib/engine/types';
import { StatusBadge, CategoryBadge, MethodBadge } from '@/components/ui/status-badge';
import { StrategyBadge } from '@/components/ui/strategy-badge';
import { TransactionDrawer } from '@/components/ui/transaction-drawer';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  CheckCheck,
  Ban,
  ArrowRight,
} from 'lucide-react';

export default function RecoveryOpportunitiesPage() {
  const {
    transactions,
    approveTransaction,
    batchApproveTransactions,
    rejectTransaction,
  } = useAppState();

  const [activeTab, setActiveTab] = useState<'NEEDS_APPROVAL' | 'RECOVERING' | 'SUPPRESSED' | 'RECOVERED'>('NEEDS_APPROVAL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  // Grouped lists
  const pendingApprovals = useMemo(() => transactions.filter((t) => t.status === 'NEEDS_APPROVAL'), [transactions]);
  const autoRecovering = useMemo(() => transactions.filter((t) => t.status === 'RECOVERING'), [transactions]);
  const suppressedList = useMemo(() => transactions.filter((t) => t.status === 'SUPPRESSED'), [transactions]);
  const recoveredList = useMemo(() => transactions.filter((t) => t.status === 'RECOVERED'), [transactions]);

  const currentList = useMemo(() => {
    switch (activeTab) {
      case 'NEEDS_APPROVAL':
        return pendingApprovals;
      case 'RECOVERING':
        return autoRecovering;
      case 'SUPPRESSED':
        return suppressedList;
      case 'RECOVERED':
        return recoveredList;
      default:
        return pendingApprovals;
    }
  }, [activeTab, pendingApprovals, autoRecovering, suppressedList, recoveredList]);

  // Selected totals for batch action
  const selectedTransactions = useMemo(() => {
    return pendingApprovals.filter((t) => selectedIds.includes(t.id));
  }, [pendingApprovals, selectedIds]);

  const totalSelectedAmount = selectedTransactions.reduce((acc, t) => acc + t.amount, 0);
  const totalSelectedEV = selectedTransactions.reduce((acc, t) => acc + t.expectedRecoveryValue, 0);

  const toggleSelectAll = () => {
    if (selectedIds.length === pendingApprovals.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingApprovals.map((t) => t.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) return;
    setIsBatchProcessing(true);
    try {
      await batchApproveTransactions(selectedIds);
      setSelectedIds([]);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  return (
    <AppLayout
      title="Recovery Opportunities"
      subtitle="Prioritized queue of failed transactions ranked by Expected Recovery Value (EV)"
    >
      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Review required</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {pendingApprovals.length} <span className="text-xs text-slate-400 font-normal font-sans">items</span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            ₹{pendingApprovals.reduce((acc, t) => acc + t.amount, 0).toLocaleString('en-IN')} held volume
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Expected value (EV)</span>
            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-medium">
              Net yield
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-700 font-mono">
            ₹{pendingApprovals.reduce((acc, t) => acc + t.expectedRecoveryValue, 0).toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-400">Risk-adjusted potential</p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>In flight</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {autoRecovering.length} <span className="text-xs text-slate-400 font-normal font-sans">dispatched</span>
          </div>
          <p className="text-[11px] text-slate-400">Auto-approved by policy</p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Suppressed</span>
            <ShieldCheck className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {suppressedList.length} <span className="text-xs text-slate-400 font-normal font-sans">suppressed</span>
          </div>
          <p className="text-[11px] text-slate-400">Prevented disputes & churn</p>
        </div>
      </div>

      {/* Main Queue Container */}
      <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
        {/* Tab Headers */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-100 pb-3 gap-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('NEEDS_APPROVAL')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'NEEDS_APPROVAL'
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>Review required ({pendingApprovals.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('RECOVERING')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'RECOVERING'
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>In flight ({autoRecovering.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('SUPPRESSED')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'SUPPRESSED'
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>Why NOT recover ({suppressedList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('RECOVERED')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'RECOVERED'
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>Settled ({recoveredList.length})</span>
            </button>
          </div>

          {/* Batch Actions */}
          {activeTab === 'NEEDS_APPROVAL' && pendingApprovals.length > 0 && (
            <div className="flex items-center gap-3">
              {selectedIds.length > 0 && (
                <span className="text-xs text-slate-600 font-mono">
                  Selected: <strong>{selectedIds.length}</strong> (EV: ₹{totalSelectedEV.toLocaleString('en-IN')})
                </span>
              )}

              <button
                type="button"
                onClick={handleBatchApprove}
                disabled={selectedIds.length === 0 || isBatchProcessing}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-slate-900 hover:bg-slate-800 text-white transition-colors flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shadow-xs"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>{isBatchProcessing ? 'Processing...' : `Approve selected (${selectedIds.length})`}</span>
              </button>
            </div>
          )}
        </div>

        {/* Tab Context Banner for "Why NOT Recover" */}
        {activeTab === 'SUPPRESSED' && (
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
            <h4 className="font-semibold text-slate-900">Suppression policy active</h4>
            <p className="text-slate-600 leading-relaxed">
              RecoverIQ suppressed retries on these transactions to protect your unit economics. Retrying high-risk cards causes chargeback penalties (₹1,500/dispute), while contacting fatigued customers accelerates subscription churn.
            </p>
          </div>
        )}

        {/* Queue Table */}
        {currentList.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <h4 className="text-sm font-semibold text-slate-900">Queue is clear</h4>
            <p className="text-xs text-slate-500">
              No transactions currently match this state.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-medium border-b border-slate-200">
                <tr>
                  {activeTab === 'NEEDS_APPROVAL' && (
                    <th className="py-3 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === pendingApprovals.length && pendingApprovals.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="py-3 px-3">Transaction</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">Failure reason</th>
                  <th className="py-3 px-3">Recommended action</th>
                  <th className="py-3 px-3 text-right">Expected value</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {currentList.map((txn) => {
                  const isSelected = selectedIds.includes(txn.id);

                  return (
                    <tr
                      key={txn.id}
                      onClick={() => setSelectedTxn(txn)}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                        isSelected ? 'bg-slate-50' : ''
                      }`}
                    >
                      {activeTab === 'NEEDS_APPROVAL' && (
                        <td className="py-3.5 px-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(txn.id)}
                            className="rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                          />
                        </td>
                      )}

                      <td className="py-3.5 px-3 font-mono font-medium text-slate-900">
                        <div>{txn.id}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{txn.orderId}</div>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="font-medium text-slate-900">{txn.customer.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                          {txn.customer.segment} • Fatigue {txn.customer.fatigueScore}/100
                        </div>
                      </td>

                      <td className="py-3.5 px-3 font-semibold text-slate-900 font-mono">
                        ₹{txn.amount.toLocaleString('en-IN')}
                      </td>

                      <td className="py-3.5 px-3">
                        <CategoryBadge category={txn.failureCategory} />
                      </td>

                      <td className="py-3.5 px-3">
                        <StrategyBadge action={txn.recommendedAction} />
                        {txn.approvalReason && (
                          <div className="text-[10px] text-amber-800 mt-0.5">
                            {txn.approvalReason}
                          </div>
                        )}
                        {txn.whyNotRationale && activeTab === 'SUPPRESSED' && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {txn.whyNotRationale}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-right font-mono font-semibold text-emerald-700">
                        ₹{txn.expectedRecoveryValue.toLocaleString('en-IN')}
                      </td>

                      <td className="py-3.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {activeTab === 'NEEDS_APPROVAL' && (
                          <button
                            type="button"
                            onClick={() => approveTransaction(txn.id)}
                            className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer"
                          >
                            Approve
                          </button>
                        )}

                        {activeTab === 'SUPPRESSED' && (
                          <span className="text-[11px] font-mono text-slate-500 px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                            Suppressed
                          </span>
                        )}

                        {activeTab === 'RECOVERING' && (
                          <span className="text-[11px] font-mono text-blue-700 px-2 py-0.5 rounded bg-blue-50 border border-blue-200">
                            Dispatched
                          </span>
                        )}

                        {activeTab === 'RECOVERED' && (
                          <span className="text-[11px] font-mono text-emerald-700 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                            Settled
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transaction Details Drawer */}
      <TransactionDrawer
        transaction={selectedTxn}
        onClose={() => setSelectedTxn(null)}
      />
    </AppLayout>
  );
}
