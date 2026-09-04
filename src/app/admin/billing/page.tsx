'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  CreditCard,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Users,
  Activity,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';

export default function AdminBillingPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [reconciliation, setReconciliation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchAdminBilling = async () => {
    setLoading(true);
    try {
      const [mRes, rRes] = await Promise.all([
        fetch('/api/admin/billing/metrics'),
        fetch('/api/billing/reconciliation'),
      ]);

      if (mRes.ok) {
        const mData = await mRes.json();
        if (mData.metrics) setMetrics(mData.metrics);
      }

      if (rRes.ok) {
        const rData = await rRes.json();
        if (rData.report) setReconciliation(rData.report);
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminBilling();
  }, []);

  const handleRunReconciliation = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/reconciliation');
      if (res.ok) {
        const data = await res.json();
        setReconciliation(data.report);
        setActionNotice('Reconciliation scan completed.');
        setTimeout(() => setActionNotice(null), 4000);
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (minor: number) => {
    return `₹${((minor || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  return (
    <AppLayout>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 font-sans">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <ShieldAlert className="w-6 h-6 text-indigo-600" />
                SaaS Commercial Operations & Billing Admin
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                Internal Ops Only
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Authoritative SaaS subscription health, revenue telemetry, provider reconciliation, and payment integrity.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunReconciliation}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 cursor-pointer disabled:opacity-50"
            >
              <Activity className="w-3.5 h-3.5" />
              Run Reconciliation
            </button>
            <button
              onClick={fetchAdminBilling}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {actionNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Commercial Revenue Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex justify-between items-center text-slate-500 text-xs">
              <span>Monthly Recurring Revenue (MRR)</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-2">
              {formatCurrency(metrics?.mrrMinor)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Derived from active subscriptions</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex justify-between items-center text-slate-500 text-xs">
              <span>Annual Run Rate (ARR)</span>
              <Layers className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-2">
              {formatCurrency(metrics?.arrMinor)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">12-month MRR projection</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex justify-between items-center text-slate-500 text-xs">
              <span>Invoiced Revenue (Booked)</span>
              <CreditCard className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-2">
              {formatCurrency(metrics?.invoicedRevenueMinor)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Collected: {formatCurrency(metrics?.collectedRevenueMinor)}
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex justify-between items-center text-slate-500 text-xs">
              <span>Trial Conversion Rate</span>
              <Users className="w-4 h-4 text-violet-600" />
            </div>
            <div className="text-2xl font-extrabold text-indigo-600 mt-2">
              {metrics?.trialConversionRate ?? 0}%
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {metrics?.activePaidCount ?? 0} Paid | {metrics?.trialingCount ?? 0} In Trial
            </div>
          </div>
        </div>

        {/* Reconciliation Health Card */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Activity className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Provider Reconciliation Engine</h3>
                <p className="text-xs text-slate-500">
                  Detects state desync between RecoverIQ internal subscription state and Razorpay billing provider.
                </p>
              </div>
            </div>
            {reconciliation && (
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  reconciliation.discrepancyCount === 0
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {reconciliation.discrepancyCount === 0 ? '100% RECONCILED' : `${reconciliation.discrepancyCount} DISCREPANCIES`}
              </span>
            )}
          </div>

          {reconciliation?.discrepancies?.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              <span className="font-semibold text-slate-800">All merchant subscriptions match external provider state.</span>
              <span className="text-slate-400">Checked {reconciliation.totalMerchantsChecked} merchant accounts. Zero discrepancies detected.</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {reconciliation?.discrepancies?.map((d: any, idx: number) => (
                <div key={idx} className="p-4 flex items-start justify-between gap-4 bg-amber-50/30">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{d.type}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                        {d.severity}
                      </span>
                    </div>
                    <p className="text-slate-600">{d.details}</p>
                    <div className="text-[11px] text-slate-400">
                      Merchant: <code className="font-mono text-slate-700">{d.merchantId}</code> | Local: {d.localStatus} | Provider: {d.providerStatus}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRunReconciliation()}
                    className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 rounded text-slate-700 text-xs font-semibold cursor-pointer shrink-0"
                  >
                    Re-verify
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
