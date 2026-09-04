'use client';

import React, { useState, useEffect } from 'react';
import {
  Code,
  Key,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  Terminal,
  Plus,
  Trash2,
  RotateCw,
  CheckCircle2,
  Webhook,
  Send,
  Activity,
  Play,
  ShieldCheck,
} from 'lucide-react';
import { ALL_API_SCOPES, ApiScope } from '@/lib/api/scopes';
import { ALL_RECOVERIQ_EVENT_TYPES, RecoverIQEventType } from '@/lib/webhooks/event-types';

interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  environment: 'TEST' | 'LIVE';
  scopes: string[];
  createdBy?: string;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
}

interface ApiLogItem {
  id: string;
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  latencyMs: number;
  createdAt: string;
}

interface WebhookEndpointItem {
  id: string;
  url: string;
  description?: string;
  subscribedEvents: string[];
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
  health?: {
    health: 'HEALTHY' | 'DEGRADED' | 'FAILING' | 'PENDING';
    successRate: number;
    totalDeliveries: number;
  };
}

interface WebhookDeliveryItem {
  id: string;
  eventId: string;
  eventType: string;
  status: 'PENDING' | 'DELIVERING' | 'DELIVERED' | 'RETRYING' | 'FAILED' | 'DEAD_LETTER' | 'CANCELLED';
  attemptCount: number;
  responseStatus?: number;
  latencyMs?: number;
  createdAt: string;
}

export default function DeveloperSettingsPage() {
  const [activeTab, setActiveTab] = useState<'api_keys' | 'webhooks'>('api_keys');

  // API Keys state
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [logs, setLogs] = useState<ApiLogItem[]>([]);
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Key creation state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [keyEnv, setKeyEnv] = useState<'TEST' | 'LIVE'>('TEST');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    ApiScope.TRANSACTIONS_READ,
    ApiScope.RECOVERY_READ,
    ApiScope.RECOVERY_EXECUTE,
  ]);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  // Webhooks state
  const [endpoints, setEndpoints] = useState<WebhookEndpointItem[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDeliveryItem[]>([]);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookDesc, setWebhookDesc] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    RecoverIQEventType.PAYMENT_FAILED,
    RecoverIQEventType.PAYMENT_RECOVERED,
    RecoverIQEventType.RECOVERY_COMPLETED,
  ]);
  const [createdWebhookSecret, setCreatedWebhookSecret] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchDeveloperData = async () => {
    setLoading(true);
    try {
      const [keysRes, logsRes, usageRes, webhooksRes, deliveriesRes] = await Promise.all([
        fetch('/api/developer/keys'),
        fetch('/api/developer/logs?limit=15'),
        fetch('/api/billing/usage?metric=API_REQUESTS'),
        fetch('/api/developer/webhooks'),
        fetch('/api/developer/webhooks/deliveries?limit=20'),
      ]);

      if (keysRes.ok) {
        const kData = await keysRes.json();
        if (kData.keys) setKeys(kData.keys);
      }

      if (logsRes.ok) {
        const lData = await logsRes.json();
        if (lData.logs) setLogs(lData.logs);
      }

      if (usageRes.ok) {
        const uData = await usageRes.json();
        if (uData.metric) setUsage(uData.metric);
      }

      if (webhooksRes.ok) {
        const wData = await webhooksRes.json();
        if (wData.endpoints) setEndpoints(wData.endpoints);
      }

      if (deliveriesRes.ok) {
        const dData = await deliveriesRes.json();
        if (dData.deliveries) setDeliveries(dData.deliveries);
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeveloperData();
  }, []);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return;

    try {
      const res = await fetch('/api/developer/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: keyName.trim(),
          environment: keyEnv,
          scopes: selectedScopes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCreatedSecret(data.rawSecret);
        setKeyName('');
        fetchDeveloperData();
      }
    } catch {
      // fallback
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action is permanent.')) return;
    try {
      const res = await fetch(`/api/developer/keys/${keyId}/revoke`, { method: 'POST' });
      if (res.ok) fetchDeveloperData();
    } catch {
      // fallback
    }
  };

  const handleRotate = async (keyId: string) => {
    if (!confirm('Rotate key? The current key will be revoked and a replacement generated.')) return;
    try {
      const res = await fetch(`/api/developer/keys/${keyId}/rotate`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setCreatedSecret(data.newRawSecret);
        fetchDeveloperData();
      }
    } catch {
      // fallback
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim()) return;

    try {
      const res = await fetch('/api/developer/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl.trim(),
          description: webhookDesc.trim(),
          subscribedEvents: selectedEvents,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCreatedWebhookSecret(data.rawSecret);
        setWebhookUrl('');
        setWebhookDesc('');
        fetchDeveloperData();
      }
    } catch {
      // fallback
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Delete this webhook endpoint permanently?')) return;
    try {
      const res = await fetch(`/api/developer/webhooks/${id}`, { method: 'DELETE' });
      if (res.ok) fetchDeveloperData();
    } catch {
      // fallback
    }
  };

  const handleTestWebhook = async (id: string) => {
    try {
      const res = await fetch(`/api/developer/webhooks/${id}/test`, { method: 'POST' });
      if (res.ok) {
        setActionNotice('Synthetic test event dispatched successfully.');
        setTimeout(() => setActionNotice(null), 4000);
        fetchDeveloperData();
      }
    } catch {
      // fallback
    }
  };

  const handleReplayDelivery = async (id: string) => {
    try {
      const res = await fetch(`/api/developer/webhooks/deliveries/${id}/replay`, { method: 'POST' });
      if (res.ok) {
        setActionNotice('Delivery replayed successfully.');
        setTimeout(() => setActionNotice(null), 4000);
        fetchDeveloperData();
      }
    } catch {
      // fallback
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const toggleEvent = (evt: string) => {
    setSelectedEvents((prev) =>
      prev.includes(evt) ? prev.filter((e) => e !== evt) : [...prev, evt]
    );
  };

  const liveKeys = keys.filter((k) => k.environment === 'LIVE');
  const testKeys = keys.filter((k) => k.environment === 'TEST');

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Code className="w-6 h-6 text-indigo-600" />
                Developer Platform
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">
                Phase 7.4 Ready
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Programmatic REST APIs, merchant API keys, and event-driven HTTPS webhook delivery infrastructure.
            </p>
          </div>
          <button
            onClick={fetchDeveloperData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>

        {actionNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('api_keys')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
              activeTab === 'api_keys'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Key className="w-4 h-4" />
              API Keys & Usage
            </span>
          </button>
          <button
            onClick={() => setActiveTab('webhooks')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
              activeTab === 'webhooks'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Webhook className="w-4 h-4" />
              Webhooks & Event Delivery
              {endpoints.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 text-[10px]">
                  {endpoints.length}
                </span>
              )}
            </span>
          </button>
        </div>

        {activeTab === 'api_keys' ? (
          <>
            {/* API Usage Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Monthly Quota</span>
                  <h3 className="text-lg font-bold text-slate-900 mt-0.5">Developer API Usage</h3>
                </div>
                {usage?.status && (
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full uppercase self-start md:self-auto ${
                      usage.status === 'WITHIN_LIMIT'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : usage.status === 'NEAR_LIMIT'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {usage.status.replace('_', ' ')}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-xs text-slate-500">API Requests This Period</span>
                  <div className="text-xl font-bold text-slate-900 mt-1">
                    {(usage?.used ?? 0).toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-xs text-slate-500">Included Allowance</span>
                  <div className="text-xl font-bold text-slate-900 mt-1">
                    {usage?.included === -1 ? 'Unlimited' : (usage?.included ?? 10000).toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-xs text-slate-500">Remaining Capacity</span>
                  <div className="text-xl font-bold text-slate-900 mt-1">
                    {usage?.remaining === -1 ? 'Unlimited' : (usage?.remaining ?? 10000).toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-xs text-slate-500">Utilization Rate</span>
                  <div className="text-xl font-bold text-indigo-600 mt-1">
                    {usage?.utilization ?? 0}%
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all"
                    style={{ width: `${Math.min(100, usage?.utilization ?? 5)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 mt-1.5">
                  <span>Meters live via Phase 7.2 Immutable Ledger</span>
                  <span>Rate limit: 120 req/min</span>
                </div>
              </div>
            </div>

            {/* API Keys Management */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">API Credentials</h2>
                  <p className="text-xs text-slate-500">Include Bearer &lt;key&gt; in the Authorization header of calls to /api/v1/*.</p>
                </div>
                <button
                  onClick={() => {
                    setCreatedSecret(null);
                    setShowCreateModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Create API Key
                </button>
              </div>

              {/* Test Keys */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Test Environment Keys</span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-100">
                      prefix: rk_test_
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">{testKeys.length} keys</span>
                </div>

                {testKeys.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">No test API keys generated yet.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {testKeys.map((k) => (
                      <div key={k.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{k.name}</span>
                            <code className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-mono">
                              {k.prefix}••••••••
                            </code>
                            {k.revokedAt && (
                              <span className="text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded font-bold border border-rose-200">
                                REVOKED
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {k.scopes.map((s) => (
                              <span key={s} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end md:self-auto">
                          {!k.revokedAt && (
                            <>
                              <button
                                onClick={() => handleRotate(k.id)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded cursor-pointer"
                                title="Rotate Key"
                              >
                                <RotateCw className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRevoke(k.id)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-50 rounded cursor-pointer"
                                title="Revoke Key"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Live Keys */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Live Production Keys</span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100">
                      prefix: rk_live_
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">{liveKeys.length} keys</span>
                </div>

                {liveKeys.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">No live production keys generated yet.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {liveKeys.map((k) => (
                      <div key={k.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{k.name}</span>
                            <code className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-mono">
                              {k.prefix}••••••••
                            </code>
                            {k.revokedAt && (
                              <span className="text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded font-bold border border-rose-200">
                                REVOKED
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {k.scopes.map((s) => (
                              <span key={s} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end md:self-auto">
                          {!k.revokedAt && (
                            <>
                              <button
                                onClick={() => handleRotate(k.id)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded cursor-pointer"
                                title="Rotate Key"
                              >
                                <RotateCw className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRevoke(k.id)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-50 rounded cursor-pointer"
                                title="Revoke Key"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent API Activity Log */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Recent API Activity</h3>
                <span className="text-xs text-slate-400">Last 15 requests</span>
              </div>

              {logs.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">No recent API requests logged yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-semibold">
                      <tr>
                        <th className="p-3">Request ID</th>
                        <th className="p-3">Method</th>
                        <th className="p-3">Path</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Latency</th>
                        <th className="p-3">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {logs.map((l) => (
                        <tr key={l.id} className="hover:bg-slate-50">
                          <td className="p-3 font-mono text-[11px] text-indigo-600">{l.requestId}</td>
                          <td className="p-3 font-bold">{l.method}</td>
                          <td className="p-3 font-mono text-[11px]">{l.path}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                l.statusCode < 300
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : l.statusCode < 500
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {l.statusCode}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500">{l.latencyMs}ms</td>
                          <td className="p-3 text-slate-400">{new Date(l.createdAt).toLocaleTimeString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Webhooks Tab */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Webhook Endpoints</h2>
                <p className="text-xs text-slate-500">
                  Receive signed HTTPS payloads as domain events occur within RecoverIQ.
                </p>
              </div>
              <button
                onClick={() => {
                  setCreatedWebhookSecret(null);
                  setShowWebhookModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Endpoint
              </button>
            </div>

            {/* Endpoints Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              {endpoints.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">No webhook endpoints registered yet.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {endpoints.map((ep) => (
                    <div key={ep.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                            {ep.url}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                              ep.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {ep.status}
                          </span>
                          {ep.health && (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                ep.health.health === 'HEALTHY'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : ep.health.health === 'DEGRADED'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {ep.health.health} ({ep.health.successRate}%)
                            </span>
                          )}
                        </div>
                        {ep.description && <p className="text-xs text-slate-500 mt-1">{ep.description}</p>}
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          {ep.subscribedEvents.map((evt) => (
                            <span key={evt} className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                              {evt}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-auto">
                        <button
                          onClick={() => handleTestWebhook(ep.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Send Test
                        </button>
                        <button
                          onClick={() => handleDeleteWebhook(ep.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-50 rounded cursor-pointer"
                          title="Delete Endpoint"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Deliveries & DLQ Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900">Recent Webhook Deliveries & DLQ</h3>
                </div>
                <span className="text-xs text-slate-400">Outbox Dispatched</span>
              </div>

              {deliveries.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">No deliveries recorded yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-semibold">
                      <tr>
                        <th className="p-3">Event ID</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Attempts</th>
                        <th className="p-3">HTTP Code</th>
                        <th className="p-3">Latency</th>
                        <th className="p-3">Time</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {deliveries.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-50">
                          <td className="p-3 font-mono text-[11px] text-indigo-600">{d.eventId}</td>
                          <td className="p-3 font-semibold">{d.eventType}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                d.status === 'DELIVERED'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : d.status === 'DEAD_LETTER'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {d.status}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500">{d.attemptCount} / 6</td>
                          <td className="p-3 font-mono text-slate-700">{d.responseStatus || '—'}</td>
                          <td className="p-3 text-slate-500">{d.latencyMs ? `${d.latencyMs}ms` : '—'}</td>
                          <td className="p-3 text-slate-400">{new Date(d.createdAt).toLocaleTimeString()}</td>
                          <td className="p-3 text-right">
                            {(d.status === 'DEAD_LETTER' || d.status === 'FAILED') && (
                              <button
                                onClick={() => handleReplayDelivery(d.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold cursor-pointer"
                              >
                                <Play className="w-3 h-3" />
                                Replay
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Signature Verification Guide */}
            <div className="bg-slate-900 text-slate-100 rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm text-white">Webhook Signature Verification (Node.js & TypeScript)</h3>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Always verify the HMAC-SHA256 signature using the exact raw request body. Never parse JSON before verification!
              </p>

              <pre className="p-3 bg-slate-950 rounded-lg overflow-x-auto text-xs font-mono text-emerald-400">
{`import crypto from 'crypto';

export function verifyRecoverIQWebhook(req, secret) {
  const signature = req.headers['x-recoveriq-signature']; // sha256=...
  const timestamp = req.headers['x-recoveriq-timestamp'];
  const rawBody = req.rawBody; // MUST be unparsed raw string/buffer

  const signedPayload = \`\${timestamp}.\${rawBody}\`;
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}`}
              </pre>
            </div>
          </div>
        )}

        {/* Integration Quick Guide */}
        <div className="bg-slate-900 text-slate-100 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Terminal className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm text-white">REST API Integration Quick Reference</h3>
          </div>

          <div className="space-y-4 text-xs font-mono">
            <div>
              <span className="text-slate-400">// Evaluate payment recovery opportunity</span>
              <pre className="mt-1 p-3 bg-slate-950 rounded-lg overflow-x-auto text-emerald-400">
{`curl -X POST https://api.recoveriq.io/api/v1/recovery/evaluate \\
  -H "Authorization: Bearer rk_test_..." \\
  -H "Content-Type: application/json" \\
  -d '{"transactionId": "txn_sample_123"}'`}
              </pre>
            </div>

            <div>
              <span className="text-slate-400">// Execute autonomous recovery with Idempotency</span>
              <pre className="mt-1 p-3 bg-slate-950 rounded-lg overflow-x-auto text-indigo-300">
{`curl -X POST https://api.recoveriq.io/api/v1/recovery/execute \\
  -H "Authorization: Bearer rk_test_..." \\
  -H "Idempotency-Key: recover_sample_123_v1" \\
  -H "Content-Type: application/json" \\
  -d '{"transactionId": "txn_sample_123"}'`}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* Create Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            {!createdSecret ? (
              <form onSubmit={handleCreateKey} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">Create API Key</h3>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="text-slate-400 hover:text-slate-600 text-sm"
                  >
                    ✕
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Key Name</label>
                  <input
                    type="text"
                    required
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    placeholder="e.g. Production Backend, Webhook Service"
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Environment</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setKeyEnv('TEST')}
                      className={`p-2.5 rounded-lg border text-xs font-bold cursor-pointer ${
                        keyEnv === 'TEST'
                          ? 'bg-blue-50 border-blue-400 text-blue-800'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      Test (rk_test_)
                    </button>
                    <button
                      type="button"
                      onClick={() => setKeyEnv('LIVE')}
                      className={`p-2.5 rounded-lg border text-xs font-bold cursor-pointer ${
                        keyEnv === 'LIVE'
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      Live (rk_live_)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Scopes</label>
                  <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                    {ALL_API_SCOPES.map((scope) => (
                      <label key={scope} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedScopes.includes(scope)}
                          onChange={() => toggleScope(scope)}
                          className="rounded text-indigo-600"
                        />
                        <span>{scope}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Generate Key
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <h3 className="text-lg font-bold text-slate-900">API Key Created</h3>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Security Warning:</strong> This secret will only be shown once. If you lose it, you will need to rotate or generate a new key.
                  </span>
                </div>

                <div className="p-3 bg-slate-900 rounded-lg flex items-center justify-between">
                  <code className="text-xs text-emerald-400 font-mono break-all">{createdSecret}</code>
                  <button
                    onClick={() => handleCopy(createdSecret, 'new-secret')}
                    className="ml-3 p-2 bg-slate-800 hover:bg-slate-700 text-white rounded cursor-pointer shrink-0"
                  >
                    {copiedKeyId === 'new-secret' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="pt-3 flex justify-end">
                  <button
                    onClick={() => {
                      setCreatedSecret(null);
                      setShowCreateModal(false);
                    }}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Webhook Modal */}
      {showWebhookModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            {!createdWebhookSecret ? (
              <form onSubmit={handleCreateWebhook} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">Register Webhook Endpoint</h3>
                  <button
                    type="button"
                    onClick={() => setShowWebhookModal(false)}
                    className="text-slate-400 hover:text-slate-600 text-sm"
                  >
                    ✕
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payload URL (HTTPS)</label>
                  <input
                    type="url"
                    required
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://merchant.example.com/api/webhooks/recoveriq"
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Description (Optional)</label>
                  <input
                    type="text"
                    value={webhookDesc}
                    onChange={(e) => setWebhookDesc(e.target.value)}
                    placeholder="e.g. ERP Invoicing Sync"
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Subscribed Events</label>
                  <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                    {ALL_RECOVERIQ_EVENT_TYPES.filter(e => e !== RecoverIQEventType.WEBHOOK_TEST).map((evt) => (
                      <label key={evt} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedEvents.includes(evt)}
                          onChange={() => toggleEvent(evt)}
                          className="rounded text-indigo-600"
                        />
                        <span className="font-mono text-[11px]">{evt}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowWebhookModal(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Create Endpoint
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <h3 className="text-lg font-bold text-slate-900">Webhook Endpoint Created</h3>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Signing Secret Warning:</strong> This webhook secret will only be revealed once. Use it to verify incoming HMAC signatures.
                  </span>
                </div>

                <div className="p-3 bg-slate-900 rounded-lg flex items-center justify-between">
                  <code className="text-xs text-emerald-400 font-mono break-all">{createdWebhookSecret}</code>
                  <button
                    onClick={() => handleCopy(createdWebhookSecret, 'whsec-new')}
                    className="ml-3 p-2 bg-slate-800 hover:bg-slate-700 text-white rounded cursor-pointer shrink-0"
                  >
                    {copiedKeyId === 'whsec-new' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="pt-3 flex justify-end">
                  <button
                    onClick={() => {
                      setCreatedWebhookSecret(null);
                      setShowWebhookModal(false);
                    }}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
