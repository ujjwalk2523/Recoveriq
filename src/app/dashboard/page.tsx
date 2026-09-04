'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRight,
  DollarSign,
  Clock,
  CheckCircle2,
  Sliders,
  ChevronRight,
  ArrowUpRight,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { MetricCard } from '@/components/ui/metric-card';
import { StatusBadge, CategoryBadge, MethodBadge } from '@/components/ui/status-badge';
import { StrategyBadge } from '@/components/ui/strategy-badge';
import { TransactionDrawer } from '@/components/ui/transaction-drawer';
import { useAppState } from '@/lib/store/app-state-provider';
import { Transaction } from '@/lib/engine/types';

export default function DashboardPage() {
  const {
    merchant,
    transactions,
    simulationResults,
    approveTransaction,
  } = useAppState();

  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [dateRange, setDateRange] = useState<'7D' | '30D' | 'MTD' | 'QTD'>('30D');

  // Pending Review Queue
  const pendingApprovals = transactions.filter((t) => t.status === 'NEEDS_APPROVAL');
  const recentRecovered = transactions.filter((t) => t.status === 'RECOVERED').slice(0, 5);

  // Financial Chart Data
  const velocityData = [
    { date: 'Aug 25', failed: 420000, recovered: 310000, avoided: 60000 },
    { date: 'Aug 26', failed: 580000, recovered: 440000, avoided: 85000 },
    { date: 'Aug 27', failed: 390000, recovered: 290000, avoided: 50000 },
    { date: 'Aug 28', failed: 640000, recovered: 490000, avoided: 90000 },
    { date: 'Aug 29', failed: 720000, recovered: 560000, avoided: 110000 },
    { date: 'Aug 30', failed: 480000, recovered: 350000, avoided: 70000 },
    { date: 'Aug 31', failed: 250000, recovered: 195000, avoided: 45000 },
  ];

  // Failure Category Data
  const categoryData = [
    { name: '3DS / OTP Drop', value: 38, count: 48, color: '#475569' },
    { name: 'Insufficient Balance', value: 27, count: 34, color: '#f59e0b' },
    { name: 'Bank Switch Timeout', value: 19, count: 24, color: '#0284c7' },
    { name: 'Expired Instrument', value: 11, count: 14, color: '#ea580c' },
    { name: 'Fraud / Dispute Risk', value: 5, count: 6, color: '#e11d48' },
  ];

  return (
    <AppLayout
      title="Revenue Dashboard"
      subtitle="Overview of recovered payments, recovery rate, and pending financial approvals"
    >
      {/* Date Filter Bar */}
      <div className="flex items-center justify-between pb-1 text-xs">
        <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-lg shadow-xs">
          {(['7D', '30D', 'MTD', 'QTD'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setDateRange(r)}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                dateRange === r
                  ? 'bg-slate-900 text-white font-medium'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {r === '7D' ? '7 days' : r === '30D' ? '30 days' : r === 'MTD' ? 'Month to date' : 'Quarter'}
            </button>
          ))}
        </div>

        <div className="text-slate-500 font-mono text-[11px]">
          Currency: <strong>INR (₹)</strong>
        </div>
      </div>

      {/* 4 Prioritized Business KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Recovered revenue"
          value={`₹${(merchant.recoveredRevenueINR / 100000).toFixed(2)}L`}
          subtitle="Net reconciled volume"
          trend={{ value: '+28.4%', isPositive: true, label: 'vs baseline' }}
        />

        <MetricCard
          title="Revenue at risk"
          value={`₹${(merchant.revenueAtRiskINR / 100000).toFixed(2)}L`}
          subtitle="Failed or abandoned"
          badge={`${pendingApprovals.length} pending`}
        />

        <MetricCard
          title="Recovery rate"
          value={`${merchant.recoveryRatePercent}%`}
          subtitle="Industry benchmark: 28%"
          trend={{ value: '+44.4%', isPositive: true, label: 'lift' }}
        />

        <MetricCard
          title="Avoided losses"
          value={`₹${(merchant.avoidedLossINR / 100000).toFixed(2)}L`}
          subtitle="Disputes & churn suppressed"
          badge="Suppression engine"
        />
      </div>

      {/* Recovery Insight Banner */}
      <div className="p-4 px-5 rounded-xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1 sm:mt-0" />
          <div className="text-xs">
            <span className="font-semibold text-slate-900 mr-2">Recovery insight:</span>
            <span className="text-slate-600">
              UPI failures between 2–4 PM are recovering 18% better when retried after 6 hours.
            </span>
          </div>
        </div>

        <Link
          href="/ai-decisions"
          className="text-xs font-semibold text-slate-900 hover:text-slate-700 flex items-center gap-1 shrink-0"
        >
          <span>View details</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Financial Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recovery Trends Area Chart (2 Cols) */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Recovery trends</h3>
              <p className="text-xs text-slate-500">Failed volume compared with net recovered and avoided loss</p>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2 h-2 rounded-full bg-slate-300" /> Failed volume
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2 h-2 rounded-full bg-emerald-600" /> Net recovered
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={velocityData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `₹${val / 100000}L`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  }}
                  formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, '']}
                />
                <Area type="monotone" dataKey="failed" stroke="#cbd5e1" fill="#f8fafc" strokeWidth={1.5} name="Failed" />
                <Area type="monotone" dataKey="recovered" stroke="#16a34a" fill="#f0fdf4" strokeWidth={2} name="Recovered" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Failure Breakdown Donut (1 Col) */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Failure reasons</h3>
            <p className="text-xs text-slate-500">Distribution across Indian payment switches</p>
          </div>

          <div className="h-44 w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={46}
                  outerRadius={66}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  }}
                  formatter={(val: any, name: any) => [`${val}%`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1 pt-2 border-t border-slate-100">
            {categoryData.map((cat) => (
              <div key={cat.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                </span>
                <span className="font-mono text-slate-900 font-medium">{cat.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Human Review Queue Table */}
      <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Pending approvals</h3>
              {pendingApprovals.length > 0 && (
                <span className="px-2 py-0.5 text-xs font-mono font-medium rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  {pendingApprovals.length} required
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              High-value transactions and enterprise accounts requiring merchant review
            </p>
          </div>

          <Link
            href="/recovery-opportunities"
            className="text-xs font-medium text-slate-700 hover:text-slate-900 flex items-center gap-1"
          >
            <span>View all</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {pendingApprovals.length === 0 ? (
          <div className="p-8 text-center rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
            <p className="text-xs text-slate-800 font-medium">All pending items reviewed</p>
            <p className="text-[11px] text-slate-500">Autonomous recovery is active on incoming payments.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Transaction</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Failure reason</th>
                  <th className="py-2.5 px-3">Recommended action</th>
                  <th className="py-2.5 px-3 text-right">Expected value</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingApprovals.slice(0, 5).map((txn) => (
                  <tr
                    key={txn.id}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => setSelectedTxn(txn)}
                  >
                    <td className="py-3 px-3 font-mono font-medium text-slate-900">
                      <div>{txn.id}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{txn.orderId}</div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-800">{txn.customer.name}</div>
                      <div className="text-[10px] text-slate-500">{txn.customer.segment} • {txn.customer.bankName || 'HDFC'}</div>
                    </td>

                    <td className="py-3 px-3 font-semibold text-slate-900 font-mono">
                      ₹{txn.amount.toLocaleString('en-IN')}
                    </td>

                    <td className="py-3 px-3">
                      <CategoryBadge category={txn.failureCategory} />
                    </td>

                    <td className="py-3 px-3">
                      <StrategyBadge action={txn.recommendedAction} />
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-700">
                      ₹{txn.expectedRecoveryValue.toLocaleString('en-IN')}
                    </td>

                    <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => approveTransaction(txn.id)}
                        className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer"
                      >
                        Approve
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Simulator Snapshot */}
      <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Strategy simulation summary</h3>
            <p className="text-xs text-slate-500">
              RecoverIQ optimization vs standard merchant recovery approaches
            </p>
          </div>
          <Link
            href="/simulator"
            className="text-xs font-semibold text-slate-900 hover:text-slate-700 flex items-center gap-1"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Open simulator</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {simulationResults.slice(0, 3).map((res) => (
            <div
              key={res.strategyKey}
              className={`p-4 rounded-xl border ${
                res.strategyKey === 'AI_OPTIMIZED'
                  ? 'bg-slate-50 border-slate-300'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-slate-700 truncate">{res.strategy}</span>
                {res.strategyKey === 'AI_OPTIMIZED' && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-900 text-white shrink-0">
                    Highest EV
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900">
                ₹{(res.recoveredRevenueINR / 100000).toFixed(2)}L
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
                <span>
                  Rate: <strong className="text-slate-900">{res.recoveryRatePercent}%</strong>
                </span>
                <span>
                  ROI: <strong className="text-slate-900">{res.roiMultiplier}x</strong>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction Details Drawer */}
      <TransactionDrawer
        transaction={selectedTxn}
        onClose={() => setSelectedTxn(null)}
      />
    </AppLayout>
  );
}
