'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useAppState } from '@/lib/store/app-state-provider';
import { Transaction } from '@/lib/engine/types';
import { StatusBadge, CategoryBadge, MethodBadge } from '@/components/ui/status-badge';
import { StrategyBadge } from '@/components/ui/strategy-badge';
import { TransactionDrawer } from '@/components/ui/transaction-drawer';
import {
  Search,
  Filter,
  Download,
  CheckCircle2,
  X,
  CheckCheck,
  Eye,
  RotateCw,
} from 'lucide-react';

export default function TransactionsPage() {
  const {
    transactions,
    setTransactions,
    approveTransaction,
    batchApproveTransactions,
    simulateIncomingWebhook,
    refreshFromBackend,
  } = useAppState();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(true);

  // Direct sync function that fetches fresh transactions from Neon DB with no caching
  const handleRefresh = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const res = await fetch(`/api/transactions?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.transactions && Array.isArray(data.transactions)) {
          setTransactions(data.transactions);
          try {
            localStorage.setItem('rcvq_transactions', JSON.stringify(data.transactions));
          } catch {}
          const nowStr = new Date().toLocaleTimeString();
          setLastSyncTime(nowStr);
          if (!silent) {
            const latest = data.transactions[0];
            const msg = latest?.orderId
              ? `Synced ${data.transactions.length} live records! Latest: ₹${latest.amount} (${latest.customer?.name || 'Customer'} - ${latest.orderId})`
              : `Synced ${data.transactions.length} transactions from Neon DB.`;
            setSyncStatus(msg);
            setTimeout(() => setSyncStatus(null), 6000);
          }
        }
      } else {
        if (!silent) setSyncStatus(`Sync error: Server returned HTTP ${res.status}`);
      }
    } catch (e: any) {
      if (!silent) setSyncStatus(`Sync failed: ${e?.message || 'Network error'}`);
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  };

  // Initial sync on mount and auto-sync polling every 5 seconds
  useEffect(() => {
    handleRefresh(true);
    if (!autoSyncEnabled) return;
    const timer = setInterval(() => {
      handleRefresh(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [autoSyncEnabled]);

  const handleClearCacheAndSync = () => {
    try {
      localStorage.removeItem('rcvq_transactions');
    } catch {}
    handleRefresh(false);
  };

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [amountRange, setAmountRange] = useState<'ALL' | 'UNDER_5K' | '5K_TO_20K' | 'OVER_20K'>('ALL');
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [sortBy, setSortBy] = useState<'amount' | 'ev' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedTxnIds, setSelectedTxnIds] = useState<string[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('txn-search-input')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filtered & Sorted transactions with robust null-safety
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((t) => {
        const q = search.toLowerCase();
        const matchesSearch =
          !search ||
          t.id?.toLowerCase().includes(q) ||
          t.orderId?.toLowerCase().includes(q) ||
          t.customer?.name?.toLowerCase().includes(q) ||
          t.customer?.email?.toLowerCase().includes(q) ||
          t.customer?.phone?.includes(q) ||
          t.failureCode?.toLowerCase().includes(q) ||
          (t.customer?.upiVpa && t.customer.upiVpa.toLowerCase().includes(q));

        const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
        const matchesMethod = methodFilter === 'ALL' || t.paymentMethod === methodFilter;
        const matchesCategory = categoryFilter === 'ALL' || t.failureCategory === categoryFilter;

        let matchesAmount = true;
        const amt = t.amount || 0;
        if (amountRange === 'UNDER_5K') matchesAmount = amt < 5000;
        else if (amountRange === '5K_TO_20K') matchesAmount = amt >= 5000 && amt <= 20000;
        else if (amountRange === 'OVER_20K') matchesAmount = amt > 20000;

        return matchesSearch && matchesStatus && matchesMethod && matchesCategory && matchesAmount;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === 'amount') diff = (a.amount || 0) - (b.amount || 0);
        else if (sortBy === 'ev') diff = (a.expectedRecoveryValue || 0) - (b.expectedRecoveryValue || 0);
        else {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          diff = dateA - dateB;
        }

        return sortOrder === 'asc' ? diff : -diff;
      });
  }, [transactions, search, statusFilter, methodFilter, categoryFilter, amountRange, sortBy, sortOrder]);

  const toggleSelectOne = (id: string) => {
    if (selectedTxnIds.includes(id)) {
      setSelectedTxnIds(selectedTxnIds.filter((item) => item !== id));
    } else {
      setSelectedTxnIds([...selectedTxnIds, id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedTxnIds.length === filteredTransactions.length && filteredTransactions.length > 0) {
      setSelectedTxnIds([]);
    } else {
      setSelectedTxnIds(filteredTransactions.map((t) => t.id));
    }
  };

  const handleBatchApprove = async () => {
    if (selectedTxnIds.length === 0) return;
    setIsBatchProcessing(true);
    try {
      await batchApproveTransactions(selectedTxnIds);
      setSelectedTxnIds([]);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const clearAllFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setMethodFilter('ALL');
    setCategoryFilter('ALL');
    setAmountRange('ALL');
  };

  const exportCSV = () => {
    const headers = [
      'Transaction ID',
      'Order ID',
      'Amount (INR)',
      'Method',
      'Status',
      'Failure Code',
      'Category',
      'Customer',
      'Recommended Action',
      'EV (INR)',
      'Confidence (%)',
      'Created At',
    ];

    const rows = filteredTransactions.map((t) => [
      t.id,
      t.orderId,
      t.amount,
      t.paymentMethod,
      t.status,
      t.failureCode,
      t.failureCategory,
      `"${t.customer.name}"`,
      t.recommendedAction,
      t.expectedRecoveryValue,
      t.actionConfidence,
      t.createdAt,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `recoveriq_transactions_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppLayout
      title="Transactions"
      subtitle="Complete ledger of failed, recovering, and recovered customer payments"
    >
      {/* Live Sync Status Banner */}
      {syncStatus && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{syncStatus}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncStatus(null)}
            className="text-emerald-700 hover:text-emerald-900 p-0.5 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Control Bar */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="txn-search-input"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, customer name, UPI ID, phone, failure reason... (⌘K)"
              className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-400 transition-colors font-sans"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
              title={autoSyncEnabled ? 'Live auto-polling every 5s is ACTIVE' : 'Auto-sync is paused'}
              className={`px-2.5 py-2 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs ${
                autoSyncEnabled
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold'
                  : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${autoSyncEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
              <span>{autoSyncEnabled ? 'Live Syncing (5s)' : 'Auto-Sync Off'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleRefresh(false)}
              disabled={isRefreshing}
              className="px-3 py-2 text-xs font-semibold rounded-lg text-slate-800 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 text-blue-600 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync Live'}</span>
            </button>

            <button
              type="button"
              onClick={handleClearCacheAndSync}
              title="Clear browser cache and reload fresh from database"
              className="px-2.5 py-2 text-xs font-medium rounded-lg text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer shadow-xs"
            >
              Reset Cache
            </button>

            <button
              type="button"
              onClick={exportCSV}
              className="px-3 py-2 text-xs font-medium rounded-lg text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1 text-xs">
          {[
            { key: 'ALL', label: 'All', count: transactions.length },
            {
              key: 'NEEDS_APPROVAL',
              label: 'Review required',
              count: transactions.filter((t) => t.status === 'NEEDS_APPROVAL').length,
            },
            {
              key: 'RECOVERING',
              label: 'In flight',
              count: transactions.filter((t) => t.status === 'RECOVERING').length,
            },
            {
              key: 'RECOVERED',
              label: 'Settled',
              count: transactions.filter((t) => t.status === 'RECOVERED').length,
            },
            {
              key: 'SUPPRESSED',
              label: 'Suppressed',
              count: transactions.filter((t) => t.status === 'SUPPRESSED').length,
            },
            {
              key: 'FAILED',
              label: 'Failed',
              count: transactions.filter((t) => t.status === 'FAILED').length,
            },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setStatusFilter(item.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusFilter === item.key
                  ? 'bg-slate-900 text-white font-medium shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>{item.label}</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  statusFilter === item.key ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {item.count}
              </span>
            </button>
          ))}
        </div>

        {/* Secondary Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-500 flex items-center gap-1 text-[11px]">
            <Filter className="w-3 h-3" /> Filters:
          </span>

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-md px-2.5 py-1 focus:outline-none focus:border-slate-400"
          >
            <option value="ALL">All methods</option>
            <option value="UPI">UPI</option>
            <option value="CARD">Cards</option>
            <option value="NETBANKING">NetBanking</option>
            <option value="MANDATE">Mandates</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-md px-2.5 py-1 focus:outline-none focus:border-slate-400"
          >
            <option value="ALL">All failure reasons</option>
            <option value="AUTHENTICATION">3DS / OTP drop</option>
            <option value="INSUFFICIENT_FUNDS">Low balance</option>
            <option value="TECHNICAL">Switch timeout</option>
            <option value="CUSTOMER_DROPOUT">User abandonment</option>
            <option value="RISK_AND_FRAUD">Risk flag</option>
            <option value="MANDATE_ISSUE">Mandate issue</option>
          </select>

          <select
            value={amountRange}
            onChange={(e) => setAmountRange(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-md px-2.5 py-1 focus:outline-none focus:border-slate-400"
          >
            <option value="ALL">All amounts</option>
            <option value="UNDER_5K">Under ₹5,000</option>
            <option value="5K_TO_20K">₹5,000 - ₹20,000</option>
            <option value="OVER_20K">Over ₹20,000</option>
          </select>

          {(search || statusFilter !== 'ALL' || methodFilter !== 'ALL' || categoryFilter !== 'ALL' || amountRange !== 'ALL') && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-[11px] text-slate-600 hover:text-slate-900 underline font-medium cursor-pointer ml-1"
            >
              Reset filters
            </button>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px]">Sort:</span>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split('-');
                setSortBy(sb as any);
                setSortOrder(so as any);
              }}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-md px-2 py-1 focus:outline-none focus:border-slate-400 font-mono"
            >
              <option value="date-desc">Newest first</option>
              <option value="date-asc">Oldest first</option>
              <option value="amount-desc">Highest amount</option>
              <option value="amount-asc">Lowest amount</option>
              <option value="ev-desc">Highest EV</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Data Table */}
      <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing <strong>{filteredTransactions.length}</strong> transactions
          </span>
          {selectedTxnIds.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900 font-mono">{selectedTxnIds.length} selected</span>
              <button
                type="button"
                onClick={handleBatchApprove}
                disabled={isBatchProcessing}
                className="px-3 py-1 text-xs font-semibold rounded bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer"
              >
                {isBatchProcessing ? 'Processing...' : 'Approve selected'}
              </button>
            </div>
          )}
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <Search className="w-8 h-8 text-slate-400 mx-auto" />
            <h4 className="text-sm font-semibold text-slate-900">No matching transactions</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No transactions match your current search or filter query.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={clearAllFilters}
                className="px-3 py-1.5 text-xs rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Clear all filters
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-medium border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={
                        selectedTxnIds.length === filteredTransactions.length &&
                        filteredTransactions.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-3">Transaction</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">Failure reason</th>
                  <th className="py-3 px-3">Recommended action</th>
                  <th className="py-3 px-3 text-right">Expected value</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredTransactions.map((txn) => {
                  const isSelected = selectedTxnIds.includes(txn.id);

                  return (
                    <tr
                      key={txn.id}
                      onClick={() => setSelectedTxn(txn)}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                        isSelected ? 'bg-slate-50' : ''
                      }`}
                    >
                      <td className="py-3.5 px-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(txn.id)}
                          className="rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      <td className="py-3.5 px-3 font-mono font-medium text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span>{txn.id}</span>
                          {(txn.orderId?.startsWith('order_') || txn.id?.startsWith('cmtn')) && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-sans font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
                              LIVE RZP
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-normal">{txn.orderId}</div>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="font-medium text-slate-900">{txn.customer?.name || 'Customer'}</div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <MethodBadge method={txn.paymentMethod} />
                          <span>{txn.customer?.segment || 'CONSUMER'}</span>
                          {txn.customer?.phone && <span className="font-mono text-slate-400 text-[10px]">{txn.customer.phone}</span>}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 font-semibold text-slate-900 font-mono">
                        ₹{(txn.amount || 0).toLocaleString('en-IN')}
                      </td>

                      <td className="py-3.5 px-3">
                        <CategoryBadge category={txn.failureCategory} />
                      </td>

                      <td className="py-3.5 px-3">
                        <StrategyBadge action={txn.recommendedAction} />
                      </td>

                      <td className="py-3.5 px-3 text-right font-mono font-semibold text-emerald-700">
                        ₹{txn.expectedRecoveryValue.toLocaleString('en-IN')}
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        <StatusBadge status={txn.status} size="sm" />
                      </td>

                      <td className="py-3.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {txn.status === 'NEEDS_APPROVAL' ? (
                          <button
                            type="button"
                            onClick={() => approveTransaction(txn.id)}
                            className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer"
                          >
                            Approve
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedTxn(txn)}
                            className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
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

      {/* Drawer */}
      <TransactionDrawer
        transaction={selectedTxn}
        onClose={() => setSelectedTxn(null)}
      />
    </AppLayout>
  );
}
