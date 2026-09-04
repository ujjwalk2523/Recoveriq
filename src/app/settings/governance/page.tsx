'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Play,
  Pause,
  Archive,
  Plus,
  RotateCcw,
  Sliders,
  History,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Layers,
  ArrowRight,
  FileCheck,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';

interface GovernancePolicy {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  category: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  priority: number;
  effect: 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL' | 'REQUIRE_STEP_UP';
  conditions: any;
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export default function GovernancePoliciesPage() {
  const [activeTab, setActiveTab] = useState<'policies' | 'simulator' | 'history'>('policies');
  const [policies, setPolicies] = useState<GovernancePolicy[]>([]);
  const [loading, setLoading] = useState(true);

  // Simulator state
  const [simAction, setSimAction] = useState('API_KEY_CREATED');
  const [simResourceType, setSimResourceType] = useState('API_KEY');
  const [simRole, setSimRole] = useState('ADMIN');
  const [simEnv, setSimEnv] = useState('production');
  const [simTimeOfDay, setSimTimeOfDay] = useState('23');
  const [simMfaAge, setSimMfaAge] = useState('1800');
  const [simulating, setSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any | null>(null);

  // New Policy Modal
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState('API');
  const [newEffect, setNewEffect] = useState<'DENY' | 'REQUIRE_STEP_UP' | 'REQUIRE_APPROVAL' | 'ALLOW'>('DENY');
  const [newPriority, setNewPriority] = useState(10);
  const [saving, setSaving] = useState(false);

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/governance/policies');
      if (res.ok) {
        const data = await res.json();
        setPolicies(data.policies || []);
      } else {
        setPolicies(generateFallbackPolicies());
      }
    } catch {
      setPolicies(generateFallbackPolicies());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const handleUpdateStatus = async (id: string, action: 'activate' | 'pause' | 'archive') => {
    try {
      const res = await fetch(`/api/governance/policies/${id}/${action}`, { method: 'POST' });
      if (res.ok) {
        await fetchPolicies();
      }
    } catch {
      // Fallback
    }
  };

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/governance/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          description: newDesc,
          category: newCategory,
          effect: newEffect,
          priority: Number(newPriority),
          conditions: {
            all: [
              { field: 'environment', operator: 'EQUALS', value: 'production' },
            ],
          },
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setNewName('');
        setNewDesc('');
        await fetchPolicies();
      }
    } catch {
      // Fallback
    } finally {
      setSaving(false);
    }
  };

  const handleRunSimulation = async () => {
    setSimulating(true);
    try {
      const res = await fetch('/api/governance/policies/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: simAction,
          resourceType: simResourceType,
          actorRole: simRole,
          environment: simEnv,
          timeOfDay: Number(simTimeOfDay),
          mfaAge: Number(simMfaAge),
        }),
      });

      if (res.ok) {
        const d = await res.json();
        setSimulationResult(d);
      }
    } catch {
      // Fallback
    } finally {
      setSimulating(false);
    }
  };

  const getEffectBadge = (effect: string) => {
    switch (effect) {
      case 'DENY':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'REQUIRE_STEP_UP':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'REQUIRE_APPROVAL':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default:
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Sliders className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Enterprise Governance Policies</h1>
                <p className="text-sm text-slate-400">
                  Deterministic preventive controls, authorization guardrails, and simulation intelligence.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition shadow-lg shadow-indigo-500/20"
            >
              <Plus className="w-4 h-4" />
              New Policy Rule
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-slate-800 pb-1">
          {[
            { id: 'policies', label: 'Active Policies', icon: ShieldCheck },
            { id: 'simulator', label: 'Policy Simulator', icon: Play },
            { id: 'history', label: 'Version Audit', icon: History },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg transition-all ${
                  isActive
                    ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ================================================================= */}
        {/* POLICIES LIST TAB */}
        {/* ================================================================= */}
        {activeTab === 'policies' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              {policies.map(pol => (
                <div
                  key={pol.id}
                  className="bg-slate-900/60 border border-slate-800 hover:border-slate-700 p-5 rounded-xl transition space-y-3"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-semibold">
                          Priority {pol.priority}
                        </span>
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold">
                          v{pol.version}
                        </span>
                        <h3 className="text-sm font-semibold text-white">{pol.name}</h3>
                      </div>
                      <p className="text-xs text-slate-400">{pol.description}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getEffectBadge(pol.effect)}`}>
                        {pol.effect}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        pol.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : pol.status === 'PAUSED'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      }`}>
                        {pol.status}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 font-mono text-[11px] text-slate-300 flex items-center justify-between">
                    <div>
                      <span className="text-slate-500 mr-2">Category:</span>
                      <span className="text-slate-200">{pol.category}</span>
                      <span className="text-slate-600 mx-3">•</span>
                      <span className="text-slate-500 mr-2">Updated:</span>
                      <span className="text-slate-400">{new Date(pol.updatedAt).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {pol.status === 'ACTIVE' ? (
                        <button
                          onClick={() => handleUpdateStatus(pol.id, 'pause')}
                          className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20 transition"
                        >
                          <Pause className="w-3 h-3" /> Pause
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUpdateStatus(pol.id, 'activate')}
                          className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 transition"
                        >
                          <Play className="w-3 h-3" /> Activate
                        </button>
                      )}

                      {pol.status !== 'ARCHIVED' && (
                        <button
                          onClick={() => handleUpdateStatus(pol.id, 'archive')}
                          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 transition"
                        >
                          <Archive className="w-3 h-3" /> Archive
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* SIMULATOR TAB */}
        {/* ================================================================= */}
        {activeTab === 'simulator' && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Safe Governance Policy Simulator</h3>
                <p className="text-xs text-slate-400">
                  Simulate operational and administrative contexts against your active policy suite without executing real actions.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1.5">Simulated Action</label>
                  <select
                    value={simAction}
                    onChange={e => setSimAction(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
                  >
                    <option value="API_KEY_CREATED">API_KEY_CREATED</option>
                    <option value="AUTH_MFA_DISABLED">AUTH_MFA_DISABLED</option>
                    <option value="ORG_OWNER_TRANSFERRED">ORG_OWNER_TRANSFERRED</option>
                    <option value="ORG_SECURITY_UPDATED">ORG_SECURITY_UPDATED</option>
                    <option value="TRANSACTION_RETRY_EXECUTED">TRANSACTION_RETRY_EXECUTED</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1.5">Resource Type</label>
                  <select
                    value={simResourceType}
                    onChange={e => setSimResourceType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
                  >
                    <option value="API_KEY">API_KEY</option>
                    <option value="MFA">MFA</option>
                    <option value="ORGANIZATION">ORGANIZATION</option>
                    <option value="PAYMENT">PAYMENT</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1.5">Actor Role</label>
                  <select
                    value={simRole}
                    onChange={e => setSimRole(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
                  >
                    <option value="OWNER">OWNER</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="OPERATOR">OPERATOR</option>
                    <option value="ANALYST">ANALYST</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1.5">Environment</label>
                  <select
                    value={simEnv}
                    onChange={e => setSimEnv(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
                  >
                    <option value="production">production</option>
                    <option value="staging">staging</option>
                    <option value="test">test</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1.5">Time of Day (UTC Hour 0-23)</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={simTimeOfDay}
                    onChange={e => setSimTimeOfDay(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1.5">MFA Age (Seconds Since Challenge)</label>
                  <input
                    type="number"
                    value={simMfaAge}
                    onChange={e => setSimMfaAge(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleRunSimulation}
                  disabled={simulating}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium transition shadow-lg shadow-indigo-500/20"
                >
                  <Play className="w-3.5 h-3.5" />
                  {simulating ? 'Evaluating...' : 'Simulate Decision'}
                </button>
              </div>
            </div>

            {/* Simulation Trace Output */}
            {simulationResult && (
              <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">Evaluation Decision:</span>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getEffectBadge(simulationResult.decision.effect)}`}>
                      {simulationResult.decision.effect}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    Evaluated {simulationResult.totalActivePoliciesEvaluated} active rules
                  </div>
                </div>

                <div className="text-xs text-slate-300 bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="font-semibold text-white">Decision Rationale:</div>
                  <p className="text-slate-400 font-mono text-[11px]">{simulationResult.decision.reason}</p>
                </div>

                {simulationResult.decision.matchedPolicies.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs text-slate-400 font-medium">Matched Policies Trace:</div>
                    <div className="space-y-1.5">
                      {simulationResult.decision.matchedPolicies.map((m: any) => (
                        <div
                          key={m.id}
                          className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-indigo-400 font-bold">P{m.priority}</span>
                            <span className="text-white font-medium">{m.name}</span>
                            <span className="text-slate-500 text-[11px]">({m.id})</span>
                          </div>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getEffectBadge(m.effect)}`}>
                            {m.effect}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* VERSION AUDIT TAB */}
        {/* ================================================================= */}
        {activeTab === 'history' && (
          <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-3">
            <h3 className="text-sm font-semibold text-white">Policy Version Audit History</h3>
            <p className="text-xs text-slate-400">
              RecoverIQ maintains append-only snapshots of every policy modification in GovernancePolicyHistory.
            </p>
            <div className="text-xs text-slate-500 py-8 text-center bg-slate-950 rounded-xl border border-slate-800">
              Select a policy from the active list to inspect full historical version diffs and rollbacks.
            </div>
          </div>
        )}

        {/* CREATE POLICY MODAL */}
        {showModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white">Create Governance Policy</h3>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              <form onSubmit={handleCreatePolicy} className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1 font-medium">Policy Name</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. Block API Key Creation in Production"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1 font-medium">Description</label>
                  <textarea
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    placeholder="Explain the security rationale..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white h-20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1 font-medium">Category</label>
                    <select
                      value={newCategory}
                      onChange={e => setNewCategory(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white"
                    >
                      <option value="API">API</option>
                      <option value="AUTHENTICATION">AUTHENTICATION</option>
                      <option value="MFA">MFA</option>
                      <option value="ORGANIZATION">ORGANIZATION</option>
                      <option value="SECURITY">SECURITY</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1 font-medium">Enforcement Effect</label>
                    <select
                      value={newEffect}
                      onChange={e => setNewEffect(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white"
                    >
                      <option value="DENY">DENY</option>
                      <option value="REQUIRE_STEP_UP">REQUIRE_STEP_UP</option>
                      <option value="REQUIRE_APPROVAL">REQUIRE_APPROVAL</option>
                      <option value="ALLOW">ALLOW</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1 font-medium">Evaluation Priority (1 - 100)</label>
                  <input
                    type="number"
                    value={newPriority}
                    onChange={e => setNewPriority(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                  >
                    {saving ? 'Creating...' : 'Create Policy'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function generateFallbackPolicies(): GovernancePolicy[] {
  return [
    {
      id: 'pol_prod_apikey_hours',
      organizationId: 'org_enterprise_1',
      name: 'Block API Key Creation Outside Business Hours',
      description: 'Prevents off-hours provisioning of programmatic API credentials.',
      category: 'API',
      status: 'ACTIVE',
      priority: 10,
      effect: 'DENY',
      conditions: {
        all: [
          { field: 'action', operator: 'EQUALS', value: 'API_KEY_CREATED' },
          { field: 'timeOfDay', operator: 'GREATER_THAN_OR_EQUAL', value: 20 },
        ],
      },
      version: 1,
      createdBy: 'usr_sec_admin',
      updatedBy: 'usr_sec_admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'pol_mfa_disable_stepup',
      organizationId: 'org_enterprise_1',
      name: 'Require MFA Step-Up Before Disabling MFA',
      description: 'Demands fresh biometric or TOTP re-authentication prior to MFA disablement.',
      category: 'MFA',
      status: 'ACTIVE',
      priority: 20,
      effect: 'REQUIRE_STEP_UP',
      conditions: {
        all: [
          { field: 'action', operator: 'EQUALS', value: 'AUTH_MFA_DISABLED' },
          { field: 'mfaAge', operator: 'GREATER_THAN', value: 300 },
        ],
      },
      version: 2,
      createdBy: 'usr_sec_admin',
      updatedBy: 'usr_sec_admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'pol_owner_transfer_approval',
      organizationId: 'org_enterprise_1',
      name: 'Require Multi-Sign-Off for Ownership Transfer',
      description: 'Blocks unilateral transfer of enterprise organization ownership.',
      category: 'ORGANIZATION',
      status: 'ACTIVE',
      priority: 5,
      effect: 'REQUIRE_APPROVAL',
      conditions: {
        all: [
          { field: 'action', operator: 'EQUALS', value: 'ORG_OWNER_TRANSFERRED' },
        ],
      },
      version: 1,
      createdBy: 'usr_sec_admin',
      updatedBy: 'usr_sec_admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}
