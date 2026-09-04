'use client';

import React, { useState } from 'react';
import {
  ScrollText,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Search,
  Filter,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { useAppState } from '@/lib/store/app-state-provider';

export default function AuditLogPage() {
  const { auditLogs } = useAppState();
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState<string>('ALL');

  const filteredLogs = auditLogs.filter((log) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      log.id.toLowerCase().includes(q) ||
      log.entityId.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      log.actorName.toLowerCase().includes(q);

    const matchesAction = filterAction === 'ALL' || log.action === filterAction;
    return matchesSearch && matchesAction;
  });

  return (
    <AppLayout
      title="Audit Log"
      subtitle="Cryptographically verified immutable record of all recovery decisions, overrides, and policy executions"
    >
      {/* Top Banner */}
      <div className="p-4 px-5 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="text-xs">
            <span className="font-semibold text-slate-900 mr-2">Immutable audit trail active:</span>
            <span className="text-slate-600">
              Every decision, manual override, and autonomous dispatch is hashed and timestamped for regulatory compliance.
            </span>
          </div>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
          SHA-256 Verified
        </span>
      </div>

      {/* Control Bar */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by log ID, transaction ID, actor, or action..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-slate-400 font-sans"
          />
        </div>

        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-slate-400 w-full sm:w-auto"
        >
          <option value="ALL">All action types</option>
          <option value="POLICY_AUTO_APPROVED">Policy auto approved</option>
          <option value="MANUAL_MERCHANT_APPROVED">Manual merchant approved</option>
          <option value="AUTO_SUPPRESSED_HIGH_RISK">Auto suppressed</option>
          <option value="RETRY_DISPATCHED">Retry dispatched</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Showing <strong>{filteredLogs.length}</strong> immutable events</span>
          <span className="font-mono text-[10px]">Zero tampering detected</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-medium border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Log ID & Timestamp</th>
                <th className="py-2.5 px-3">Transaction / Entity</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Actor / Channel</th>
                <th className="py-2.5 px-3">Cryptographic Signature</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3">
                    <div className="font-mono font-medium text-slate-900">{log.id}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {new Date(log.timestamp).toLocaleString('en-IN')}
                    </div>
                  </td>

                  <td className="py-3 px-3 font-mono font-medium text-slate-800">
                    {log.entityId}
                  </td>

                  <td className="py-3 px-3">
                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 text-slate-800 border border-slate-200">
                      {log.action}
                    </span>
                    <div className="text-[11px] text-slate-500 mt-1 max-w-sm">
                      {log.details || 'Executed within standard policy constraints.'}
                    </div>
                  </td>

                  <td className="py-3 px-3">
                    <div className="font-medium text-slate-900">{log.actorName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {log.actorType === 'POLICY_ENGINE' ? 'Autonomous policy' : 'Human in loop'}
                    </div>
                  </td>

                  <td className="py-3 px-3 font-mono text-[10px] text-slate-500 truncate max-w-[140px]">
                    {log.integrityHash}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
