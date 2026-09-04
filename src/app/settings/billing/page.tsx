'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Zap,
  Sparkles,
  RefreshCw,
  Clock,
  Sliders,
  ChevronRight,
  FileText,
  Lock,
  Layers,
  Info,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';

interface PlanInfo {
  code: string;
  name: string;
  description: string;
  monthlyPriceMinor: number;
  currency: string;
  includedTransactions: number;
  includedRecoveryAttempts: number;
  includedApiRequests: number;
  features: Record<string, boolean>;
}

export default function BillingSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [subscription, setSubscription] = useState<any>({
    planCode: 'GROWTH',
    status: 'ACTIVE',
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: new Date(Date.now() + 26 * 24 * 60 * 60 * 1000).toISOString(),
    isTrialActive: false,
    trialEnd: null,
  });

  const [usage, setUsage] = useState<any>({
    transactionsCount: 12842,
    transactionsLimit: 50000,
    recoveryAttemptsCount: 18432,
    recoveryAttemptsLimit: 100000,
    apiRequestsCount: 21204,
    apiRequestsLimit: 100000,
  });

  const [usageSummary, setUsageSummary] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  const [events, setEvents] = useState<any[]>([
    {
      id: 'sev_01',
      eventType: 'PLAN_CHANGED',
      previousPlan: 'STARTER',
      newPlan: 'GROWTH',
      actor: 'Ujjwal (Admin)',
      createdAt: '2026-09-01T10:00:00Z',
    },
    {
      id: 'sev_00',
      eventType: 'TRIAL_STARTED',
      newPlan: 'STARTER',
      newStatus: 'TRIALING',
      actor: 'SYSTEM',
      createdAt: '2026-08-18T10:00:00Z',
    },
  ]);

  const [plans, setPlans] = useState<PlanInfo[]>([
    {
      code: 'STARTER',
      name: 'Starter',
      description: 'Autonomous payment recovery for growing startups and early-stage merchants.',
      monthlyPriceMinor: 199900,
      currency: 'INR',
      includedTransactions: 5000,
      includedRecoveryAttempts: 10000,
      includedApiRequests: 10000,
      features: {
        BASIC_ANALYTICS: true,
        AUTONOMOUS_RECOVERY: true,
        ML_OPTIMIZATION: false,
        CONTEXTUAL_BANDIT: false,
        EXPERIMENTS: false,
        API_ACCESS: true,
        ADVANCED_INTELLIGENCE: false,
        CUSTOM_POLICIES: false,
        TEAM_MANAGEMENT: false,
        PRIORITY_SUPPORT: false,
        ENTERPRISE_CONTROLS: false,
      },
    },
    {
      code: 'GROWTH',
      name: 'Growth',
      description: 'Full ML-powered recovery intelligence, contextual bandit routing, and A/B experiments.',
      monthlyPriceMinor: 799900,
      currency: 'INR',
      includedTransactions: 50000,
      includedRecoveryAttempts: 100000,
      includedApiRequests: 100000,
      features: {
        BASIC_ANALYTICS: true,
        AUTONOMOUS_RECOVERY: true,
        ML_OPTIMIZATION: true,
        CONTEXTUAL_BANDIT: true,
        EXPERIMENTS: true,
        API_ACCESS: true,
        ADVANCED_INTELLIGENCE: true,
        CUSTOM_POLICIES: true,
        TEAM_MANAGEMENT: false,
        PRIORITY_SUPPORT: false,
        ENTERPRISE_CONTROLS: false,
      },
    },
    {
      code: 'SCALE',
      name: 'Scale',
      description: 'High-volume recovery infrastructure with priority execution, multi-team RBAC, and dedicated support.',
      monthlyPriceMinor: 2499900,
      currency: 'INR',
      includedTransactions: 250000,
      includedRecoveryAttempts: 500000,
      includedApiRequests: 1000000,
      features: {
        BASIC_ANALYTICS: true,
        AUTONOMOUS_RECOVERY: true,
        ML_OPTIMIZATION: true,
        CONTEXTUAL_BANDIT: true,
        EXPERIMENTS: true,
        API_ACCESS: true,
        ADVANCED_INTELLIGENCE: true,
        CUSTOM_POLICIES: true,
        TEAM_MANAGEMENT: true,
        PRIORITY_SUPPORT: true,
        ENTERPRISE_CONTROLS: false,
      },
    },
    {
      code: 'ENTERPRISE',
      name: 'Enterprise',
      description: 'Bespoke high-volume SLA, custom guardrail configurations, enterprise audit trails, and dedicated compliance.',
      monthlyPriceMinor: -1,
      currency: 'INR',
      includedTransactions: -1,
      includedRecoveryAttempts: -1,
      includedApiRequests: -1,
      features: {
        BASIC_ANALYTICS: true,
        AUTONOMOUS_RECOVERY: true,
        ML_OPTIMIZATION: true,
        CONTEXTUAL_BANDIT: true,
        EXPERIMENTS: true,
        API_ACCESS: true,
        ADVANCED_INTELLIGENCE: true,
        CUSTOM_POLICIES: true,
        TEAM_MANAGEMENT: true,
        PRIORITY_SUPPORT: true,
        ENTERPRISE_CONTROLS: true,
      },
    },
  ]);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchBillingData = async () => {
    setLoading(true);
    try {
      const [subRes, plansRes, eventsRes, usageRes, invRes] = await Promise.all([
        fetch('/api/billing/subscription'),
        fetch('/api/billing/plans'),
        fetch('/api/billing/subscription/events'),
        fetch('/api/billing/usage'),
        fetch('/api/billing/invoices'),
      ]);

      if (subRes.ok) {
        const subData = await subRes.json();
        if (subData.subscription) setSubscription(subData.subscription);
        if (subData.usage) setUsage(subData.usage);
      }

      if (plansRes.ok) {
        const pData = await plansRes.json();
        if (pData.plans?.length) setPlans(pData.plans);
      }

      if (eventsRes.ok) {
        const evData = await eventsRes.json();
        if (evData.events?.length) setEvents(evData.events);
      }

      if (usageRes.ok) {
        const uData = await usageRes.json();
        if (uData.usage) setUsageSummary(uData.usage);
      }

      if (invRes.ok) {
        const iData = await invRes.json();
        if (iData.invoices) setInvoices(iData.invoices);
      }
    } catch {
      // resilient
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, []);

  const handleChangePlan = async (targetPlanCode: string) => {
    setActionLoading(true);
    setNotification(null);
    try {
      const res = await fetch('/api/billing/subscription/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPlanCode: targetPlanCode }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification({ type: 'success', message: data.message });
        await fetchBillingData();
      } else {
        setNotification({ type: 'error', message: data.error || 'Failed to update plan.' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription?')) return;
    setActionLoading(true);
    setNotification(null);
    try {
      const res = await fetch('/api/billing/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification({ type: 'success', message: 'Subscription cancelled successfully.' });
        await fetchBillingData();
      } else {
        setNotification({ type: 'error', message: data.error || 'Cancellation failed.' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivateSubscription = async () => {
    setActionLoading(true);
    setNotification(null);
    try {
      const res = await fetch('/api/billing/subscription/reactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification({ type: 'success', message: 'Subscription reactivated successfully.' });
        await fetchBillingData();
      } else {
        setNotification({ type: 'error', message: data.error || 'Reactivation failed.' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const formatPrice = (minor: number) => {
    if (minor === -1) return 'Custom';
    return `₹${(minor / 100).toLocaleString('en-IN')}`;
  };

  const currentPlan = plans.find((p) => p.code === subscription.planCode) || plans[1];
  const isCancelled = subscription.status === 'CANCELLED';

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <CreditCard className="w-6 h-6 text-indigo-600" />
                Subscription & Plans
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                Phase 7.1 Billing Domain
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Manage your commercial plan, monthly transaction allowances, and platform feature entitlements.
            </p>
          </div>
          <button
            onClick={fetchBillingData}
            disabled={loading || actionLoading}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Notification Banner */}
        {notification && (
          <div
            className={`p-4 rounded-xl flex items-center gap-3 text-sm font-semibold border ${
              notification.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Provider Integration Notice */}
        <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs text-indigo-900 font-medium">
            <Info className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              <strong>Billing Architecture Notice:</strong> Phase 7.2 Usage Metering & Immutable Ledger active. Every billable event is idempotently recorded in the append-only ledger. Billing provider charging is handled in subsequent release.
            </span>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 shrink-0">
            INTERNAL USAGE LEDGER v1.0
          </span>
        </div>

        {/* Top Overview: Current Plan & Usage */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Current Plan Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Plan</span>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                    subscription.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : subscription.status === 'TRIALING'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {subscription.status}
                </span>
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900">{currentPlan.name}</h2>
              <div className="text-3xl font-extrabold text-slate-900 mt-2">
                {formatPrice(currentPlan.monthlyPriceMinor)}
                {currentPlan.monthlyPriceMinor !== -1 && (
                  <span className="text-sm font-normal text-slate-500"> / month</span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-2">{currentPlan.description}</p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Billing Period:</span>
                <span className="font-semibold text-slate-900">
                  {new Date(subscription.currentPeriodStart).toLocaleDateString()} –{' '}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </span>
              </div>
              {subscription.status === 'TRIALING' && subscription.trialEnd && (
                <div className="flex justify-between text-amber-700 font-semibold">
                  <span>Trial Expires:</span>
                  <span>{new Date(subscription.trialEnd).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Plan Usage */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Monthly Usage</span>
                {usageSummary?.metrics?.TRANSACTIONS_PROCESSED?.status && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      usageSummary.metrics.TRANSACTIONS_PROCESSED.status === 'WITHIN_LIMIT'
                        ? 'bg-emerald-50 text-emerald-700'
                        : usageSummary.metrics.TRANSACTIONS_PROCESSED.status === 'NEAR_LIMIT'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {usageSummary.metrics.TRANSACTIONS_PROCESSED.status.replace('_', ' ')}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-1">Platform Capacity</h3>

              <div className="mt-4 space-y-4">
                {/* Transactions */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 font-medium">Monthly Transactions</span>
                    <span className="font-bold text-slate-900">
                      {(usageSummary?.metrics?.TRANSACTIONS_PROCESSED?.used ?? usage.transactionsCount).toLocaleString('en-IN')} /{' '}
                      {usage.transactionsLimit === -1 ? 'Unlimited' : usage.transactionsLimit.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        usageSummary?.metrics?.TRANSACTIONS_PROCESSED?.status === 'OVER_LIMIT'
                          ? 'bg-rose-500'
                          : usageSummary?.metrics?.TRANSACTIONS_PROCESSED?.status === 'NEAR_LIMIT'
                          ? 'bg-amber-500'
                          : 'bg-indigo-600'
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          usage.transactionsLimit === -1
                            ? 15
                            : ((usageSummary?.metrics?.TRANSACTIONS_PROCESSED?.used ?? usage.transactionsCount) /
                                usage.transactionsLimit) *
                              100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Recovery Attempts */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 font-medium">Recovery Attempts</span>
                    <span className="font-bold text-slate-900">
                      {(usageSummary?.metrics?.RECOVERY_ATTEMPTS?.used ?? usage.recoveryAttemptsCount).toLocaleString('en-IN')} /{' '}
                      {usage.recoveryAttemptsLimit === -1
                        ? 'Unlimited'
                        : usage.recoveryAttemptsLimit.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          usage.recoveryAttemptsLimit === -1
                            ? 18
                            : ((usageSummary?.metrics?.RECOVERY_ATTEMPTS?.used ?? usage.recoveryAttemptsCount) /
                                usage.recoveryAttemptsLimit) *
                              100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* API Requests */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 font-medium">API Requests</span>
                    <span className="font-bold text-slate-900">
                      {(usageSummary?.metrics?.API_REQUESTS?.used ?? usage.apiRequestsCount).toLocaleString('en-IN')} /{' '}
                      {usage.apiRequestsLimit === -1 ? 'Unlimited' : usage.apiRequestsLimit.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          usage.apiRequestsLimit === -1
                            ? 21
                            : ((usageSummary?.metrics?.API_REQUESTS?.used ?? usage.apiRequestsCount) /
                                usage.apiRequestsLimit) *
                              100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Recovered Revenue & Transactions */}
                {usageSummary?.metrics?.RECOVERED_REVENUE && (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex flex-col">
                      <span className="text-slate-500 text-[11px]">Recovered Txns</span>
                      <span className="font-bold text-slate-900">
                        {usageSummary.metrics.RECOVERED_TRANSACTIONS?.used?.toLocaleString('en-IN') ?? 0}
                      </span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-slate-500 text-[11px]">Recovered Revenue</span>
                      <span className="font-bold text-emerald-600">
                        ₹{((usageSummary.metrics.RECOVERED_REVENUE?.amountMinor || 0) / 100).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
              Resets at the start of next billing period.
            </div>
          </div>

          {/* Active Features Checklist */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Entitlements</span>
              <h3 className="text-lg font-bold text-slate-900 mt-1">Included in Your Plan</h3>

              <ul className="mt-4 space-y-2 text-xs">
                {Object.entries(currentPlan.features).map(([feat, enabled]) => (
                  <li key={feat} className="flex items-center gap-2">
                    {enabled ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center shrink-0">
                        <Lock className="w-2.5 h-2.5 text-slate-400" />
                      </span>
                    )}
                    <span className={enabled ? 'font-medium text-slate-800' : 'text-slate-400'}>
                      {feat.replace(/_/g, ' ')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Cancel / Reactivate Actions */}
            <div className="mt-6 pt-4 border-t border-slate-100">
              {isCancelled ? (
                <button
                  onClick={handleReactivateSubscription}
                  disabled={actionLoading}
                  className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  Reactivate Subscription
                </button>
              ) : (
                <button
                  onClick={handleCancelSubscription}
                  disabled={actionLoading}
                  className="w-full py-2 px-3 text-xs font-semibold rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer disabled:opacity-50"
                >
                  Cancel Subscription
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Change Plan Grid */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Commercial Plans</h2>
            <p className="text-xs text-slate-500">Upgrade or downgrade your plan anytime. Prorated adjustments apply automatically.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {plans.map((p) => {
              const isSelected = p.code === subscription.planCode;
              return (
                <div
                  key={p.code}
                  className={`bg-white rounded-xl border p-5 flex flex-col justify-between shadow-xs transition-all ${
                    isSelected ? 'border-indigo-600 ring-2 ring-indigo-600/10' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-slate-900">{p.name}</h3>
                      {isSelected && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                          CURRENT
                        </span>
                      )}
                    </div>
                    <div className="text-2xl font-extrabold text-slate-900 mb-2">
                      {formatPrice(p.monthlyPriceMinor)}
                      {p.monthlyPriceMinor !== -1 && (
                        <span className="text-xs font-normal text-slate-500"> /mo</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mb-4 min-h-[36px]">{p.description}</p>

                    <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Transactions:</span>
                        <span className="font-semibold text-slate-900">
                          {p.includedTransactions === -1 ? 'Unlimited' : p.includedTransactions.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Attempts:</span>
                        <span className="font-semibold text-slate-900">
                          {p.includedRecoveryAttempts === -1
                            ? 'Unlimited'
                            : p.includedRecoveryAttempts.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>API Calls:</span>
                        <span className="font-semibold text-slate-900">
                          {p.includedApiRequests === -1 ? 'Unlimited' : p.includedApiRequests.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => handleChangePlan(p.code)}
                      disabled={isSelected || actionLoading}
                      className={`w-full py-2 px-3 text-xs font-semibold rounded-lg cursor-pointer disabled:opacity-50 ${
                        isSelected
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs'
                      }`}
                    >
                      {isSelected ? 'Current Plan' : 'Select Plan'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Invoices & Statements */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Invoices & Statements</h3>
              <p className="text-xs text-slate-500">Immutable financial records and billing period overage breakdowns.</p>
            </div>
            <span className="text-xs text-slate-400">{invoices.length} invoices</span>
          </div>

          {invoices.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No finalized invoices yet. First statement generates at the end of your billing cycle.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Invoice Number</th>
                    <th className="px-4 py-3">Billing Period</th>
                    <th className="px-4 py-3">Base Price</th>
                    <th className="px-4 py-3">Overage</th>
                    <th className="px-4 py-3">Total Due</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono font-bold text-indigo-600">
                        {inv.invoiceNumber}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-[11px]">
                        {new Date(inv.periodStart).toLocaleDateString()} – {new Date(inv.periodEnd).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        ₹{(inv.subtotalMinor / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {inv.overageMinor > 0 ? `₹${(inv.overageMinor / 100).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 font-extrabold text-slate-900">
                        ₹{(inv.totalMinor / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            inv.status === 'PAID'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : inv.status === 'OPEN'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : inv.status === 'PAST_DUE'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded cursor-pointer"
                        >
                          View Breakdown
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Invoice Details Modal */}
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-xs text-slate-400 font-mono">Invoice</span>
                  <h3 className="text-lg font-bold text-slate-900">{selectedInvoice.invoiceNumber}</h3>
                </div>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 uppercase">Itemized Line Items</span>
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden text-xs">
                  {selectedInvoice.lineItems?.map((li: any) => (
                    <div key={li.id} className="p-3 flex justify-between items-center bg-slate-50/50">
                      <div>
                        <div className="font-semibold text-slate-900">{li.description}</div>
                        {li.metric && (
                          <div className="text-[10px] text-slate-500">
                            Measured: {li.usageMeasured} | Included: {li.usageIncluded} | Excess: {li.quantity}
                          </div>
                        )}
                      </div>
                      <div className="font-bold text-slate-900">
                        ₹{(li.totalMinor / 100).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-sm">
                <span className="font-bold text-slate-700">Total Due:</span>
                <span className="text-lg font-extrabold text-slate-900">
                  ₹{(selectedInvoice.totalMinor / 100).toFixed(2)}
                </span>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Subscription Event History */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Subscription History</h3>
              <p className="text-xs text-slate-500">Append-only audit trail of all plan and billing lifecycle changes.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Event Type</th>
                  <th className="px-4 py-3">Plan Change</th>
                  <th className="px-4 py-3">Status Change</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[11px]">
                        {ev.eventType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {ev.previousPlan && ev.newPlan
                        ? `${ev.previousPlan} → ${ev.newPlan}`
                        : ev.newPlan || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {ev.previousStatus && ev.newStatus
                        ? `${ev.previousStatus} → ${ev.newStatus}`
                        : ev.newStatus || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{ev.actor}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono">
                      {new Date(ev.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
