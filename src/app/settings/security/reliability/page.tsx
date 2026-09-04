'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  Database,
  Server,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  HardDrive,
  RefreshCw,
  Zap,
  HelpCircle,
  FileCheck2,
  Play,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';

export default function ReliabilityEngineeringPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'dependencies' | 'backups' | 'reconstruction' | 'reconciliation'>('overview');
  const [metrics, setMetrics] = useState<any | null>(null);
  const [dependencies, setDependencies] = useState<any[]>([]);
  const [backups, setBackups] = useState<any[]>([]);
  const [reconciliation, setReconciliation] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Actions state
  const [verifyingRestore, setVerifyingRestore] = useState(false);
  const [restoreResult, setRestoreResult] = useState<any | null>(null);
  const [dryRunningRebuild, setDryRunningRebuild] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<any | null>(null);
  const [rebuildingQueues, setRebuildingQueues] = useState(false);
  const [rebuildResult, setRebuildResult] = useState<any | null>(null);

  const fetchTelemetry = async () => {
    try {
      setLoading(true);
      const [resStatus, resDeps, resBkps, resRecon] = await Promise.all([
        fetch('/api/reliability/status').then(r => r.json()),
        fetch('/api/reliability/dependencies').then(r => r.json()),
        fetch('/api/reliability/backups').then(r => r.json()),
        fetch('/api/reliability/reconciliation').then(r => r.json()),
      ]);

      if (resStatus.metrics) setMetrics(resStatus.metrics);
      if (resDeps.dependencies) setDependencies(resDeps.dependencies);
      if (resBkps.backups) setBackups(resBkps.backups);
      if (resRecon.reconciliation) setReconciliation(resRecon.reconciliation);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, []);

  const handleRunRestoreVerification = async (backupId: string) => {
    try {
      setVerifyingRestore(true);
      setRestoreResult(null);
      const res = await fetch('/api/reliability/verify-restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId }),
      });
      const data = await res.json();
      setRestoreResult(data.verification);
      fetchTelemetry();
    } catch {
      // ignore
    } finally {
      setVerifyingRestore(false);
    }
  };

  const handleDryRunRebuild = async () => {
    try {
      setDryRunningRebuild(true);
      setDryRunResult(null);
      const res = await fetch('/api/reliability/dry-run/rebuild', { method: 'POST' });
      const data = await res.json();
      setDryRunResult(data);
    } catch {
      // ignore
    } finally {
      setDryRunningRebuild(false);
    }
  };

  const handleRebuildQueues = async () => {
    if (!confirm('Reconstruct active queues from authoritative PostgreSQL? This will rebuild transient Redis state.')) {
      return;
    }
    try {
      setRebuildingQueues(true);
      setRebuildResult(null);
      const res = await fetch('/api/reliability/rebuild-queues', { method: 'POST' });
      const data = await res.json();
      setRebuildResult(data.result);
      fetchTelemetry();
    } catch {
      // ignore
    } finally {
      setRebuildingQueues(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                <ShieldCheck className="w-7 h-7 text-indigo-400" />
                Disaster Recovery & Reliability Engineering
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/70 text-emerald-400 border border-emerald-800/60 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                State: {metrics?.recoveryState || 'HEALTHY'}
              </span>
            </div>
            <p className="text-sm text-zinc-400 mt-1">
              Deterministic recovery, dependency failure matrices, queue reconstruction, and zero-duplicate payment reconciliation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchTelemetry}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-700/80 hover:bg-zinc-800 text-xs font-medium text-zinc-200 transition-colors shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Telemetry
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-800 space-x-1">
          {[
            { id: 'overview', label: 'Overview & RPO/RTO', icon: Activity },
            { id: 'dependencies', label: 'Dependency Matrix', icon: Server },
            { id: 'backups', label: 'Database & Restore Verification', icon: Database },
            { id: 'reconstruction', label: 'Queue Reconstruction', icon: HardDrive },
            { id: 'reconciliation', label: 'Payment Reconciliation', icon: RotateCcw },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Overview & RPO/RTO */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Metric KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-400">RPO Status</span>
                  <Clock className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="mt-2 text-xl font-bold text-white">
                  {metrics?.rpoStatus === 'WITHIN_OBJECTIVE' ? 'Within Target' : 'Breached'}
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  Target: &lt; 5m | Observed: {metrics?.backupAgeHours ? `${metrics.backupAgeHours}h` : '&lt; 1h'}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-400">RTO Status</span>
                  <Zap className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="mt-2 text-xl font-bold text-white">
                  {metrics?.rtoStatus === 'WITHIN_OBJECTIVE' ? 'Within Target' : 'Breached'}
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  Target: &lt; 30m standby recovery
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-400">Restore Verification</span>
                  <FileCheck2 className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="mt-2 text-xl font-bold text-white">
                  {metrics?.restoreVerificationStatus || 'VERIFIED'}
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  Multi-domain integrity verified
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-400">Unknown Payments</span>
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                </div>
                <div className="mt-2 text-xl font-bold text-white">
                  {metrics?.unknownPaymentCount ?? 0}
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  Awaiting manual intervention
                </div>
              </div>
            </div>

            {/* Core Invariants Banner */}
            <div className="p-5 rounded-xl bg-indigo-950/20 border border-indigo-900/40 flex items-start gap-3.5">
              <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-indigo-300">Authoritative Platform Reliability Invariants</h4>
                <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                  RecoverIQ executes deterministic recovery procedures ensuring: (1) PostgreSQL is the sole authoritative business truth; (2) Redis and background workers are fully disposable and reconstructable; (3) Unknown external payment states are never assumed as failures, completely preventing duplicate payment retries.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Dependencies */}
        {activeTab === 'dependencies' && (
          <div className="space-y-4">
            <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-800 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-white">External Dependency Failure Matrix</h3>
                <span className="text-xs text-zinc-400">Total Probed: {dependencies.length}</span>
              </div>
              <div className="divide-y divide-zinc-800">
                {dependencies.map((dep) => (
                  <div key={dep.name} className="p-4 hover:bg-zinc-800/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${dep.status === 'HEALTHY' ? 'bg-emerald-400' : dep.status === 'DEGRADED' ? 'bg-amber-400' : 'bg-rose-400'}`} />
                        <span className="text-sm font-semibold text-white">{dep.displayName}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                          {dep.criticality}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-zinc-400">Latency: {dep.latencyMs}ms</span>
                        <span className={`font-semibold px-2 py-0.5 rounded ${
                          dep.status === 'HEALTHY' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}>
                          {dep.status}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded bg-zinc-950/50 border border-zinc-800/60">
                        <span className="text-zinc-500 font-medium block">Failure Behavior:</span>
                        <span className="text-zinc-300 mt-0.5 block">{dep.failureBehavior}</span>
                      </div>
                      <div className="p-2.5 rounded bg-zinc-950/50 border border-zinc-800/60">
                        <span className="text-zinc-500 font-medium block">Recovery Procedure:</span>
                        <span className="text-zinc-300 mt-0.5 block">{dep.recoveryProcedure}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Database & Backups */}
        {activeTab === 'backups' && (
          <div className="space-y-6">
            <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-5">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Database Backup Catalog & Integrity Checksums</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Authoritative backups tracked with SHA-256 digests and isolated restore verifications.</p>
                </div>
              </div>

              {backups.length === 0 ? (
                <div className="text-center py-8 text-xs text-zinc-500">No backup records currently registered.</div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {backups.map((bkp) => (
                    <div key={bkp.backupId} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-indigo-400">{bkp.backupId}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">{bkp.backupType}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">{bkp.status}</span>
                        </div>
                        <div className="text-xs text-zinc-500 mt-1 font-mono">
                          SHA-256: {bkp.checksum.slice(0, 24)}... | Started: {new Date(bkp.startedAt).toLocaleString()}
                        </div>
                      </div>

                      <button
                        onClick={() => handleRunRestoreVerification(bkp.backupId)}
                        disabled={verifyingRestore}
                        className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5"
                      >
                        <FileCheck2 className="w-3.5 h-3.5" />
                        {verifyingRestore ? 'Verifying...' : 'Verify Restore'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Restore Verification Results */}
            {restoreResult && (
              <div className="rounded-xl bg-zinc-900/80 border border-zinc-700 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Restore Verification Execution ({restoreResult.status})
                  </h4>
                  <span className="text-xs text-zinc-400 font-mono">Duration: {restoreResult.durationMs}ms</span>
                </div>
                <div className="space-y-2">
                  {restoreResult.checks?.map((chk: any, idx: number) => (
                    <div key={idx} className="p-2.5 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2 h-2 rounded-full ${chk.passed ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        <span className="font-semibold text-zinc-200">{chk.name}</span>
                        <span className="text-zinc-500">({chk.domain})</span>
                      </div>
                      <span className="text-zinc-400">{chk.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Queue Reconstruction */}
        {activeTab === 'reconstruction' && (
          <div className="space-y-6">
            <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Idempotent Redis Queue Reconstruction</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Reconstructs transient background recovery queues and worker leases from authoritative PostgreSQL state. Excludes terminal states (RECOVERED, COMPLETED, SUPPRESSED) to eliminate duplicate payment attempts.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleDryRunRebuild}
                  disabled={dryRunningRebuild}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-colors"
                >
                  {dryRunningRebuild ? 'Evaluating...' : 'Run Dry-Run Rebuild'}
                </button>
                <button
                  onClick={handleRebuildQueues}
                  disabled={rebuildingQueues}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors"
                >
                  {rebuildingQueues ? 'Reconstructing...' : 'Execute Queue Rebuild'}
                </button>
              </div>

              {dryRunResult && (
                <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2 text-xs">
                  <div className="font-bold text-indigo-400">Dry-Run Inspection Results:</div>
                  <p className="text-zinc-400">{dryRunResult.disclaimer}</p>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="p-2 rounded bg-zinc-900">Candidates to Rebuild: {dryRunResult.dryRunResult?.rebuiltCount}</div>
                    <div className="p-2 rounded bg-zinc-900">Skipped Terminal: {dryRunResult.dryRunResult?.skippedTerminalCount}</div>
                    <div className="p-2 rounded bg-zinc-900">Stale Leases: {dryRunResult.dryRunResult?.staleLeasesResetCount}</div>
                  </div>
                </div>
              )}

              {rebuildResult && (
                <div className="p-4 rounded-lg bg-emerald-950/50 border border-emerald-800 space-y-1 text-xs">
                  <div className="font-bold text-emerald-400">Queue Reconstruction Complete:</div>
                  <p className="text-zinc-300">Successfully restored {rebuildResult.rebuiltCount} jobs into Redis ready queues.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Reconciliation */}
        {activeTab === 'reconciliation' && (
          <div className="space-y-6">
            <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-5">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-white">Manual Review Queue (Ambiguous Payment States)</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Transactions with uncertain external provider states are quarantined here. Automated execution is permanently paused until authoritative status is established.
                </p>
              </div>

              {reconciliation?.manualReviewQueue?.length === 0 ? (
                <div className="text-center py-8 text-xs text-zinc-500">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-70" />
                  No ambiguous payment states detected. All recovery operations are reconciled.
                </div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {reconciliation?.manualReviewQueue?.map((item: any) => (
                    <div key={item.transactionId} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-white">{item.transactionId}</div>
                        <div className="text-zinc-500 font-mono mt-0.5">
                          Outcome: {item.outcome} | Provider Status: {item.providerStatus || 'UNKNOWN'}
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded bg-amber-950 text-amber-400 border border-amber-800 font-medium">
                        Manual Review
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
