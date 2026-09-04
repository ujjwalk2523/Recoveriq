'use client';

import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import {
  Sliders,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Zap,
  Info,
  RotateCcw,
  CheckCircle2,
  Building,
  ShoppingBag,
  Briefcase,
  ArrowRight,
  SlidersHorizontal,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { useAppState } from '@/lib/store/app-state-provider';
import { DEFAULT_SIMULATOR_PARAMS } from '@/lib/engine/simulator-engine';

export default function SimulatorPage() {
  const {
    simulatorParams,
    updateSimulatorParams,
    simulationResults,
    updatePolicies,
  } = useAppState();

  const [activePreset, setActivePreset] = useState<'SAAS' | 'D2C' | 'ENTERPRISE' | 'CUSTOM'>('CUSTOM');
  const [appliedNotification, setAppliedNotification] = useState(false);

  const handleApplyPreset = (preset: 'SAAS' | 'D2C' | 'ENTERPRISE') => {
    setActivePreset(preset);
    if (preset === 'SAAS') {
      updateSimulatorParams({
        monthlyFailedVolumeINR: 2500000,
        avgTicketSizeINR: 3800,
        primaryMethodShare: { upi: 50, cards: 35, netbanking: 10, mandates: 5 },
        retryDelayHours: 6,
        whatsAppEnabled: true,
        whatsAppCostINR: 1.5,
        paymentLinkEnabled: true,
        aiOptimizationMode: 'BALANCED',
      });
    } else if (preset === 'D2C') {
      updateSimulatorParams({
        monthlyFailedVolumeINR: 5000000,
        avgTicketSizeINR: 1450,
        primaryMethodShare: { upi: 75, cards: 15, netbanking: 5, mandates: 5 },
        retryDelayHours: 4,
        whatsAppEnabled: true,
        whatsAppCostINR: 1.5,
        paymentLinkEnabled: true,
        aiOptimizationMode: 'MAX_REVENUE',
      });
    } else if (preset === 'ENTERPRISE') {
      updateSimulatorParams({
        monthlyFailedVolumeINR: 8500000,
        avgTicketSizeINR: 24000,
        primaryMethodShare: { upi: 20, cards: 50, netbanking: 25, mandates: 5 },
        retryDelayHours: 8,
        whatsAppEnabled: false,
        whatsAppCostINR: 1.5,
        paymentLinkEnabled: true,
        aiOptimizationMode: 'MIN_FATIGUE',
      });
    }
  };

  const handleResetParams = () => {
    setActivePreset('CUSTOM');
    updateSimulatorParams(DEFAULT_SIMULATOR_PARAMS);
  };

  const handleApplyToLivePolicy = () => {
    updatePolicies({
      autoApproveMaxAmount: Math.min(30000, Math.round(simulatorParams.avgTicketSizeINR * 3.5)),
      allowAutomatedWhatsAppNudges: simulatorParams.whatsAppEnabled,
      allowAutomatedPaymentLinks: simulatorParams.paymentLinkEnabled,
    });
    setAppliedNotification(true);
    setTimeout(() => setAppliedNotification(false), 3500);
  };

  const chartData = simulationResults.map((r) => ({
    name: r.strategy.replace('Scheduled ', '').replace('RecoverIQ ', '').replace('Interactive ', '').replace('Multi-Rail ', ''),
    netRecovered: r.netRecoveredINR,
    grossRecovered: r.recoveredRevenueINR,
    cost: r.totalInterventionCostINR,
    rate: r.recoveryRatePercent,
    key: r.strategyKey,
  }));

  const aiResult = simulationResults.find((r) => r.strategyKey === 'AI_OPTIMIZED');
  const immediateResult = simulationResults.find((r) => r.strategyKey === 'IMMEDIATE_RETRY');

  const additionalRevenueOverImmediate =
    aiResult && immediateResult ? aiResult.netRecoveredINR - immediateResult.netRecoveredINR : 0;

  return (
    <AppLayout
      title="Recovery Simulator"
      subtitle="Forecast recovery rates, intervention costs, and net revenue across candidate strategies"
    >
      {/* Industry Presets Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-900">Industry presets:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => handleApplyPreset('SAAS')}
            className={`px-3 py-1.5 rounded-md border transition-colors cursor-pointer flex items-center gap-1.5 ${
              activePreset === 'SAAS'
                ? 'bg-slate-900 text-white font-medium border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>SaaS Subscriptions (₹25L / ₹3.8k ticket)</span>
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset('D2C')}
            className={`px-3 py-1.5 rounded-md border transition-colors cursor-pointer flex items-center gap-1.5 ${
              activePreset === 'D2C'
                ? 'bg-slate-900 text-white font-medium border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>D2C E-Commerce (₹50L / ₹1.4k ticket)</span>
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset('ENTERPRISE')}
            className={`px-3 py-1.5 rounded-md border transition-colors cursor-pointer flex items-center gap-1.5 ${
              activePreset === 'ENTERPRISE'
                ? 'bg-slate-900 text-white font-medium border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Enterprise B2B (₹85L / ₹24k ticket)</span>
          </button>
        </div>
      </div>

      {appliedNotification && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Simulation settings applied to merchant policy. Auto-approval ceiling set to ₹
            {Math.min(30000, Math.round(simulatorParams.avgTicketSizeINR * 3.5)).toLocaleString('en-IN')}.
          </span>
        </div>
      )}

      {/* Main Grid: Parameters on Left, Analysis on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Parameter Controls (1 Col) */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-slate-900">Simulation parameters</h3>
            <button
              type="button"
              onClick={handleResetParams}
              className="text-[11px] text-slate-500 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          {/* Volume */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Monthly failed volume</span>
              <span className="font-mono font-bold text-slate-900">
                ₹{(simulatorParams.monthlyFailedVolumeINR / 100000).toFixed(1)}L
              </span>
            </div>
            <input
              type="range"
              min={500000}
              max={10000000}
              step={250000}
              value={simulatorParams.monthlyFailedVolumeINR}
              onChange={(e) => {
                setActivePreset('CUSTOM');
                updateSimulatorParams({ monthlyFailedVolumeINR: Number(e.target.value) });
              }}
              className="w-full accent-slate-900 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>₹5L</span>
              <span>₹50L</span>
              <span>₹1Cr</span>
            </div>
          </div>

          {/* Ticket Size */}
          <div className="space-y-2 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Average ticket size</span>
              <span className="font-mono font-bold text-slate-900">
                ₹{simulatorParams.avgTicketSizeINR.toLocaleString('en-IN')}
              </span>
            </div>
            <input
              type="range"
              min={499}
              max={35000}
              step={250}
              value={simulatorParams.avgTicketSizeINR}
              onChange={(e) => {
                setActivePreset('CUSTOM');
                updateSimulatorParams({ avgTicketSizeINR: Number(e.target.value) });
              }}
              className="w-full accent-slate-900 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>₹499 (Consumer)</span>
              <span>₹3,800 (SaaS)</span>
              <span>₹35,000 (B2B)</span>
            </div>
          </div>

          {/* Retry Delay */}
          <div className="space-y-2 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Retry delay window</span>
              <span className="font-mono font-bold text-slate-900">
                {simulatorParams.retryDelayHours} Hours
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={24}
              step={1}
              value={simulatorParams.retryDelayHours}
              onChange={(e) => {
                setActivePreset('CUSTOM');
                updateSimulatorParams({ retryDelayHours: Number(e.target.value) });
              }}
              className="w-full accent-slate-900 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>1h (Immediate)</span>
              <span>6h (Optimal)</span>
              <span>24h (Next day)</span>
            </div>
          </div>

          {/* Channels */}
          <div className="space-y-2.5 pt-3 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-900 block">Channel controls</span>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div>
                <p className="text-xs text-slate-800 font-medium">WhatsApp 1-tap link</p>
                <p className="text-[10px] text-slate-500 font-mono">Unit cost: ₹1.50 / message</p>
              </div>
              <input
                type="checkbox"
                checked={simulatorParams.whatsAppEnabled}
                onChange={(e) => {
                  setActivePreset('CUSTOM');
                  updateSimulatorParams({ whatsAppEnabled: e.target.checked });
                }}
                className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div>
                <p className="text-xs text-slate-800 font-medium">Payment link dispatch</p>
                <p className="text-[10px] text-slate-500 font-mono">Unit cost: ₹3.20 / link</p>
              </div>
              <input
                type="checkbox"
                checked={simulatorParams.paymentLinkEnabled}
                onChange={(e) => {
                  setActivePreset('CUSTOM');
                  updateSimulatorParams({ paymentLinkEnabled: e.target.checked });
                }}
                className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
              />
            </div>
          </div>

          {/* Strategy Mode */}
          <div className="space-y-2 pt-3 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-900 block">Optimization goal</span>
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              {(['BALANCED', 'MAX_REVENUE', 'MIN_FATIGUE'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setActivePreset('CUSTOM');
                    updateSimulatorParams({ aiOptimizationMode: mode });
                  }}
                  className={`py-1.5 px-2 rounded-md font-medium transition-colors cursor-pointer text-center ${
                    simulatorParams.aiOptimizationMode === mode
                      ? 'bg-slate-900 text-white font-semibold shadow-xs'
                      : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  {mode === 'BALANCED' ? 'Balanced' : mode === 'MAX_REVENUE' ? 'Max ₹' : 'Min churn'}
                </button>
              ))}
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleApplyToLivePolicy}
              className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Apply to merchant policy</span>
            </button>
          </div>
        </div>

        {/* Right Column: Comparative Results & Charts (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Revenue Lift Banner */}
          {additionalRevenueOverImmediate > 0 && (
            <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Projected net recovery lift
                </span>
                <div className="text-3xl font-bold font-mono text-emerald-700 mt-0.5">
                  +₹{(additionalRevenueOverImmediate / 100000).toFixed(2)} Lakhs
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Additional net recovered revenue per month over blind gateway retries
                </p>
              </div>

              <div className="text-right font-mono text-xs text-slate-500 space-y-1">
                <div>AI recovery rate: <strong className="text-slate-900 font-bold">{aiResult?.recoveryRatePercent}%</strong></div>
                <div>Blind retry rate: <strong className="text-slate-600">{immediateResult?.recoveryRatePercent}%</strong></div>
                <div>ROI multiple: <strong className="text-emerald-700 font-bold">{aiResult?.roiMultiplier}x</strong></div>
              </div>
            </div>
          )}

          {/* Comparative Bar Chart */}
          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Net recovered revenue by strategy</h3>
                <p className="text-xs text-slate-500">Comparing expected monetary yield after factoring channel intervention costs</p>
              </div>
              <span className="text-xs font-mono text-slate-500">INR (₹)</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
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
                    formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Net Recovered']}
                  />
                  <Bar dataKey="netRecovered" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.key === 'AI_OPTIMIZED' ? '#0f172a' : entry.key === 'BASELINE' ? '#cbd5e1' : '#64748b'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 text-slate-500">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-slate-900" /> AI Optimized
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-slate-500" /> Single Channel Rail
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-slate-300" /> No Action
                </span>
              </div>
            </div>
          </div>

          {/* Comparative Matrix Table */}
          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Strategy economics</h3>

            <div className="space-y-3">
              {simulationResults.map((sim) => (
                <div
                  key={sim.strategyKey}
                  className={`p-4 rounded-xl border transition-colors ${
                    sim.strategyKey === 'AI_OPTIMIZED'
                      ? 'bg-slate-50 border-slate-300 shadow-xs'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{sim.strategy}</span>
                      {sim.strategyKey === 'AI_OPTIMIZED' && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-900 text-white">
                          Optimal Strategy
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-sm font-bold text-slate-900">
                      ₹{sim.netRecoveredINR.toLocaleString('en-IN')} Net
                      <span className="text-xs text-slate-500 font-normal font-sans ml-1.5">
                        ({sim.recoveryRatePercent}% rate)
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed mb-3">
                    {sim.description}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs font-mono text-slate-500">
                    <div>
                      <span>Gross: </span>
                      <strong className="text-slate-900">₹{(sim.recoveredRevenueINR / 100000).toFixed(2)}L</strong>
                    </div>
                    <div>
                      <span>Intervention cost: </span>
                      <strong className="text-slate-900">₹{sim.totalInterventionCostINR.toLocaleString('en-IN')}</strong>
                    </div>
                    <div>
                      <span>ROI: </span>
                      <strong className="text-emerald-700 font-semibold">{sim.roiMultiplier}x</strong>
                    </div>
                    <div>
                      <span>Avoided loss: </span>
                      <strong className="text-slate-900">₹{sim.avoidedLossesINR.toLocaleString('en-IN')}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
