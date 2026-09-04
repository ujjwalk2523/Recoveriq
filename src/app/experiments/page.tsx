'use client';

import React, { useState } from 'react';
import {
  FlaskConical,
  Award,
  CheckCircle2,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { useAppState } from '@/lib/store/app-state-provider';
import { RecoveryExperiment } from '@/lib/engine/types';

export default function ExperimentsPage() {
  const { experiments } = useAppState();
  const [selectedExp, setSelectedExp] = useState<RecoveryExperiment>(experiments[0]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <AppLayout
      title="Experiment Lab"
      subtitle="A/B and multi-armed bandit recovery strategy testing with statistical significance"
    >
      {/* Top Banner */}
      <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Active recovery experiments</h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              2 active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Test recovery channels against control baselines. Measure net revenue lift, intervention unit economics, customer friction, and mean time to settlement.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>New experiment</span>
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left List */}
        <div className="space-y-2.5">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider px-1 block text-[10px]">
            Experiments ({experiments.length})
          </span>

          {experiments.map((exp) => {
            const isSelected = selectedExp.id === exp.id;
            return (
              <div
                key={exp.id}
                onClick={() => setSelectedExp(exp)}
                className={`p-4 rounded-xl border transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-slate-100 border-slate-300 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono font-bold text-slate-500">
                    {exp.id.toUpperCase()}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Running
                  </span>
                </div>

                <h4 className="text-xs font-semibold text-slate-900 leading-snug">{exp.title}</h4>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{exp.hypothesis}</p>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2.5 mt-2.5 border-t border-slate-200 font-mono">
                  <span>Traffic: {exp.totalTraffic} txns</span>
                  <span className="text-emerald-700 font-medium">99.8% conf.</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Drilldown */}
        <div className="lg:col-span-2 space-y-5">
          {/* Header & Hypothesis */}
          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-500">{selectedExp.id}</span>
              <span className="text-xs text-slate-500 font-mono">
                Started: {new Date(selectedExp.startDate).toLocaleDateString('en-IN')}
              </span>
            </div>

            <h3 className="text-base font-bold text-slate-900">{selectedExp.title}</h3>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
              <span className="font-semibold text-slate-900">Hypothesis: </span>
              {selectedExp.hypothesis}
            </div>
          </div>

          {/* Comparative Arms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Control */}
            <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">
                    Control group
                  </span>
                  <h4 className="text-sm font-semibold text-slate-900">{selectedExp.controlArm.name}</h4>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  {selectedExp.controlArm.trafficAllocationPercent}% traffic
                </span>
              </div>

              <div className="space-y-1">
                <div className="text-2xl font-bold font-mono text-slate-900">
                  {selectedExp.controlArm.recoveryRatePercent}%
                </div>
                <p className="text-xs text-slate-500">
                  Recovered ₹{(selectedExp.controlArm.recoveredRevenueINR / 100000).toFixed(2)}L from{' '}
                  {selectedExp.controlArm.sampleSize} txns
                </p>
              </div>

              <div className="space-y-1.5 pt-3 border-t border-slate-100 text-xs font-mono text-slate-500">
                <div className="flex justify-between">
                  <span>Net recovered:</span>
                  <strong className="text-slate-900">
                    ₹{selectedExp.controlArm.netRecoveredINR.toLocaleString('en-IN')}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Intervention cost:</span>
                  <strong className="text-slate-900">
                    ₹{selectedExp.controlArm.totalInterventionCostINR}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Mean recovery time:</span>
                  <strong className="text-slate-900">
                    {selectedExp.controlArm.averageTimeToRecoverMinutes} mins
                  </strong>
                </div>
              </div>
            </div>

            {/* Variant */}
            {selectedExp.variantArms.map((arm) => (
              <div
                key={arm.id}
                className="p-5 rounded-xl bg-slate-50 border border-slate-300 shadow-xs space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono uppercase text-slate-500 font-bold">
                        Variant group
                      </span>
                      {arm.isWinner && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Winner (+
                          {Math.round(
                            arm.recoveryRatePercent - selectedExp.controlArm.recoveryRatePercent
                          )}
                          % lift)
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900">{arm.name}</h4>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                    {arm.trafficAllocationPercent}% traffic
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-2xl font-bold font-mono text-emerald-700">
                    {arm.recoveryRatePercent}%
                  </div>
                  <p className="text-xs text-slate-600">
                    Recovered ₹{(arm.recoveredRevenueINR / 100000).toFixed(2)}L from {arm.sampleSize} txns
                  </p>
                </div>

                <div className="space-y-1.5 pt-3 border-t border-slate-200 text-xs font-mono text-slate-600">
                  <div className="flex justify-between">
                    <span>Net recovered:</span>
                    <strong className="text-emerald-700 font-bold">
                      ₹{arm.netRecoveredINR.toLocaleString('en-IN')}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Intervention cost:</span>
                    <strong className="text-slate-900">
                      ₹{arm.totalInterventionCostINR.toLocaleString('en-IN')}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Statistical confidence:</span>
                    <strong className="text-emerald-700 font-bold">{arm.statisticalConfidence}% (p &lt; 0.001)</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Insights */}
          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
            <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              Statistical findings & learnings
            </h4>

            <div className="space-y-2">
              {selectedExp.insights.map((insight, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{insight}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-900">Create recovery experiment</h3>
            <p className="text-xs text-slate-500">
              Configure a split test to compare a recovery action against baseline retries.
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 font-medium block mb-1">Experiment name</label>
                <input
                  type="text"
                  defaultValue="Delayed 10 AM Retry vs Immediate Switch Ping"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white"
                />
              </div>
              <div>
                <label className="text-slate-700 font-medium block mb-1">Hypothesis</label>
                <textarea
                  defaultValue="Scheduling retry at 10 AM following morning will yield 3x higher recovery for insufficient funds."
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white h-20"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  alert('Experiment configured and active on incoming traffic.');
                  setShowCreateModal(false);
                }}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white"
              >
                Launch experiment
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
