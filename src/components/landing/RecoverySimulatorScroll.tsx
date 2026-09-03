'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sliders,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  Zap,
  Clock,
  MessageSquare,
  Ban,
  Activity,
  Calculator,
} from 'lucide-react';
import CountUpNumber from './CountUpNumber';
import MagneticButton from './MagneticButton';
import Link from 'next/link';

const PRESETS = [
  { label: '₹10 Lakhs', value: 1000000 },
  { label: '₹25 Lakhs', value: 2500000 },
  { label: '₹50 Lakhs', value: 5000000 },
  { label: '₹1 Crore', value: 10000000 },
];

export default function RecoverySimulatorScroll() {
  const [simVolume, setSimVolume] = useState<number>(2500000); // Default 25 Lakhs
  const [activeStrategy, setActiveStrategy] = useState<'ai' | 'scheduled' | 'whatsapp' | 'immediate'>('ai');

  // Realistic fintech math
  const immediateRate = 0.148;
  const whatsappRate = 0.194;
  const scheduledRate = 0.237;
  const aiRate = 0.314;

  const immediateNet = Math.round(simVolume * immediateRate - (simVolume / 3500) * 0.25);
  const whatsappNet = Math.round(simVolume * whatsappRate - (simVolume / 3500) * 1.50);
  const scheduledNet = Math.round(simVolume * scheduledRate - (simVolume / 3500) * 0.25);
  const aiNet = Math.round(simVolume * aiRate - (simVolume / 3500) * 0.85);

  const netLift = aiNet - immediateNet;

  // Cohort partitioning breakdown
  const highTier = simVolume * 0.42;
  const medTier = simVolume * 0.31;
  const suppressedTier = simVolume * 0.27;

  return (
    <section id="simulator" className="py-24 bg-slate-50 border-t border-slate-200 select-none">
      <div className="max-w-5xl mx-auto px-6 space-y-12">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-mono text-slate-700 shadow-xs">
            <Calculator className="w-3.5 h-3.5 text-emerald-600" />
            <span>Interactive Cohort Simulator</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Simulate recovery yield on your payment volume.
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Adjust your monthly failed payment cohort to see how RecoverIQ partitions transactions into deterministic tiers and maximizes net recovered capital.
          </p>
        </div>

        {/* Main Simulator Workbench */}
        <div className="p-6 md:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-8">
          {/* Top Control Bar: Volume Slider & Presets */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-mono uppercase text-slate-400 font-bold block">
                  Monthly Failed Payment Volume
                </span>
                <span className="text-xs text-slate-500">
                  Drag slider or pick a cohort tier below
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900">
                  ₹{(simVolume / 100000).toFixed(1)} Lakhs
                </span>
                <span className="text-xs font-mono text-slate-400">/ month</span>
              </div>
            </div>

            {/* Custom Range Slider */}
            <input
              type="range"
              min={500000}
              max={10000000}
              step={250000}
              value={simVolume}
              onChange={(e) => setSimVolume(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
            />

            {/* Preset Buttons */}
            <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setSimVolume(p.value)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                    simVolume === p.value
                      ? 'bg-slate-900 text-white font-bold shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Cohort Partitioning Rail */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-500">
              <span className="font-semibold text-slate-900">Deterministic Cohort Partitioning:</span>
              <span className="text-emerald-700 font-bold">100% Cohort Triaged</span>
            </div>

            {/* Triaged Multi-Segment Bar */}
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex gap-0.5 p-0.5 border border-slate-200">
              <motion.div
                layout
                className="h-full bg-emerald-500 rounded-l-full"
                style={{ width: '42%' }}
                title="42% High Probability"
              />
              <motion.div
                layout
                className="h-full bg-blue-500"
                style={{ width: '31%' }}
                title="31% Medium Probability"
              />
              <motion.div
                layout
                className="h-full bg-slate-400 rounded-r-full"
                style={{ width: '27%' }}
                title="27% Low / Suppressed"
              />
            </div>

            {/* 3 Partition Detail Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              {/* Tier 1 */}
              <motion.div
                whileHover={{ y: -2 }}
                className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-emerald-900">42% Auto-Recovery</span>
                  <span className="text-emerald-700 font-semibold">91% Odds</span>
                </div>
                <div className="text-lg font-bold font-mono text-emerald-900">
                  ₹{(highTier / 100000).toFixed(2)}L
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Switch timeouts & morning salary accounts routed to silent retry.
                </p>
              </motion.div>

              {/* Tier 2 */}
              <motion.div
                whileHover={{ y: -2 }}
                className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-blue-900">31% WhatsApp Nudge</span>
                  <span className="text-blue-700 font-semibold">68% Odds</span>
                </div>
                <div className="text-lg font-bold font-mono text-blue-900">
                  ₹{(medTier / 100000).toFixed(2)}L
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  3DS OTP drop-offs re-engaged with instant 1-tap deep links.
                </p>
              </motion.div>

              {/* Tier 3 */}
              <motion.div
                whileHover={{ y: -2 }}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-slate-800">27% Guardrail Suppressed</span>
                  <span className="text-slate-500 font-semibold">0% Odds</span>
                </div>
                <div className="text-lg font-bold font-mono text-slate-900">
                  ₹{(suppressedTier / 100000).toFixed(2)}L
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Hard card declines suppressed to avoid gateway penalty fees.
                </p>
              </motion.div>
            </div>
          </div>

          {/* Strategy Comparative Grid with Interactive Selection */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-500">
              <span className="font-semibold text-slate-900">Net Expected Recovery by Strategy:</span>
              <span>Click strategy to inspect</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Strategy 1: Immediate */}
              <div
                onClick={() => setActiveStrategy('immediate')}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  activeStrategy === 'immediate'
                    ? 'border-slate-400 bg-slate-50 shadow-sm ring-1 ring-slate-400/30'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-slate-600 font-medium">Immediate Retry</span>
                  <span className="font-mono text-slate-500 font-bold">14.8%</span>
                </div>
                <div className="text-xl font-bold font-mono text-slate-900">
                  ₹{(immediateNet / 100000).toFixed(2)}L
                </div>
                <p className="text-[10px] font-mono text-slate-400 mt-2">
                  Baseline default • High decline risk
                </p>
              </div>

              {/* Strategy 2: WhatsApp */}
              <div
                onClick={() => setActiveStrategy('whatsapp')}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  activeStrategy === 'whatsapp'
                    ? 'border-blue-400 bg-blue-50/30 shadow-sm ring-1 ring-blue-400/30'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-slate-600 font-medium">WhatsApp 1-Tap</span>
                  <span className="font-mono text-blue-700 font-bold">19.4%</span>
                </div>
                <div className="text-xl font-bold font-mono text-slate-900">
                  ₹{(whatsappNet / 100000).toFixed(2)}L
                </div>
                <p className="text-[10px] font-mono text-slate-400 mt-2">
                  4-min recovery • ₹1.50 unit cost
                </p>
              </div>

              {/* Strategy 3: Scheduled */}
              <div
                onClick={() => setActiveStrategy('scheduled')}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  activeStrategy === 'scheduled'
                    ? 'border-amber-400 bg-amber-50/30 shadow-sm ring-1 ring-amber-400/30'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-slate-600 font-medium">Scheduled (6h)</span>
                  <span className="font-mono text-amber-700 font-bold">23.7%</span>
                </div>
                <div className="text-xl font-bold font-mono text-slate-900">
                  ₹{(scheduledNet / 100000).toFixed(2)}L
                </div>
                <p className="text-[10px] font-mono text-slate-400 mt-2">
                  Off-peak timing • Zero fatigue
                </p>
              </div>

              {/* Strategy 4: AI Winner */}
              <div
                onClick={() => setActiveStrategy('ai')}
                className={`p-4 rounded-2xl border transition-all cursor-pointer bg-slate-900 text-white ${
                  activeStrategy === 'ai'
                    ? 'border-emerald-500 shadow-md ring-2 ring-emerald-500/30'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> RecoverIQ AI
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">31.4%</span>
                </div>
                <div className="text-xl font-extrabold font-mono text-emerald-400">
                  ₹{(aiNet / 100000).toFixed(2)}L
                </div>
                <p className="text-[10px] font-mono text-slate-400 mt-2">
                  Dynamic multi-rail • Optimal EV
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Lift Banner */}
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase text-emerald-800 font-bold block">
                  Expected Incremental Net Lift vs Baseline
                </span>
                <div className="text-base font-extrabold font-mono text-emerald-950">
                  +₹{netLift.toLocaleString('en-IN')} net recovered capital / month
                </div>
              </div>
            </div>

            <MagneticButton maxDistance={6}>
              <Link
                href="/simulator"
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition-all flex items-center gap-1.5 shrink-0 shadow-xs hover:shadow-md cursor-pointer"
              >
                <span>Open Full Simulator</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </MagneticButton>
          </div>
        </div>
      </div>
    </section>
  );
}
