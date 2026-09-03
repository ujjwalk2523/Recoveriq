'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FlaskConical,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Zap,
  ArrowRight,
  RotateCcw,
  Activity,
} from 'lucide-react';
import CountUpNumber from './CountUpNumber';
import MagneticButton from './MagneticButton';
import Link from 'next/link';

interface ExperimentTier {
  id: string;
  label: string;
  size: number;
  controlRecovered: number;
  variantRecovered: number;
  liftAmount: number;
  controlRate: number;
  variantRate: number;
  pVal: string;
  annualLift: string;
}

const EXPERIMENT_TIERS: ExperimentTier[] = [
  {
    id: '1k',
    label: '1,000 Txns',
    size: 1000,
    controlRecovered: 370000,
    variantRecovered: 785000,
    liftAmount: 415000,
    controlRate: 14.8,
    variantRate: 31.4,
    pVal: 'p < 0.001',
    annualLift: '+₹49.8 Lakhs/yr',
  },
  {
    id: '5k',
    label: '5,000 Txns',
    size: 5000,
    controlRecovered: 1850000,
    variantRecovered: 3925000,
    liftAmount: 2075000,
    controlRate: 14.8,
    variantRate: 31.4,
    pVal: 'p < 0.0001',
    annualLift: '+₹2.49 Cr/yr',
  },
  {
    id: '25k',
    label: '25,000 Txns',
    size: 25000,
    controlRecovered: 9250000,
    variantRecovered: 19625000,
    liftAmount: 10375000,
    controlRate: 14.8,
    variantRate: 31.4,
    pVal: 'p < 0.00001',
    annualLift: '+₹12.45 Cr/yr',
  },
];

export default function StatisticalSplitLab() {
  const [activeTier, setActiveTier] = useState<ExperimentTier>(EXPERIMENT_TIERS[0]);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [hoveredArm, setHoveredArm] = useState<'control' | 'variant' | null>(null);

  const triggerSimulation = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
    }, 1000);
  };

  return (
    <section id="experiments" className="py-24 bg-white border-t border-slate-200 select-none">
      <div className="max-w-5xl mx-auto px-6 space-y-10">
        {/* Header with Sample Size Selector */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-100 pb-6">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-mono text-slate-700 shadow-xs">
              <FlaskConical className="w-3.5 h-3.5 text-slate-700" />
              <span>Statistical Split Testing</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Prove recovery lift with controlled experiments.
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Test recovery actions against baseline controls on live merchant traffic. Measure statistical confidence, mean recovery velocity, and incremental revenue.
            </p>
          </div>

          {/* Sample Size Switcher & Re-simulate Button */}
          <div className="flex items-center gap-2 self-start md:self-auto shrink-0 flex-wrap">
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
              {EXPERIMENT_TIERS.map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => {
                    setActiveTier(tier);
                    triggerSimulation();
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                    activeTier.id === tier.id
                      ? 'bg-white text-slate-900 font-bold shadow-xs border border-slate-200'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {tier.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={triggerSimulation}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:shadow-xs transition-all flex items-center gap-1.5 text-xs font-mono cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-slate-500 ${isSimulating ? 'animate-spin text-emerald-600' : ''}`} />
              <span className="hidden sm:inline">Simulate</span>
            </button>
          </div>
        </div>

        {/* Live Traffic Partition Status Bar */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            <span>Traffic Partition:</span>
            <strong className="text-slate-900">50% Control vs 50% RecoverIQ AI</strong>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-500">
            <span>Statistical Power: <strong className="text-slate-900">99.8%</strong></span>
            <span>p-value: <strong className="text-emerald-700 font-bold">{activeTier.pVal}</strong></span>
            <span>Sample: <strong className="text-slate-900">N={activeTier.size.toLocaleString('en-IN')}</strong></span>
          </div>
        </div>

        {/* Two Comparison Cards: Control vs Variant */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Control Arm (50% Traffic) */}
          <motion.div
            whileHover={{ y: -2 }}
            onMouseEnter={() => setHoveredArm('control')}
            onMouseLeave={() => setHoveredArm(null)}
            className={`p-6 rounded-2xl border transition-all duration-200 bg-white ${
              hoveredArm === 'control'
                ? 'border-slate-400 shadow-md'
                : 'border-slate-200 shadow-xs'
            }`}
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
              <span className="text-xs font-mono uppercase text-slate-400 font-bold">
                Control Group (50%)
              </span>
              <span className="text-xs font-mono text-slate-500">Immediate Retry</span>
            </div>

            {/* Rate */}
            <div className="space-y-1">
              <div className="text-3xl font-bold font-mono text-slate-900">
                <CountUpNumber value={activeTier.controlRate} suffix="%" decimals={1} />
              </div>
              <p className="text-xs text-slate-500">Recovery rate</p>
            </div>

            {/* Benchmark Bar */}
            <div className="my-4 space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>Yield Benchmark</span>
                <span>14.8%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-slate-400 rounded-full w-[14.8%]" />
              </div>
            </div>

            {/* Metrics */}
            <div className="pt-3 border-t border-slate-100 text-xs font-mono text-slate-500 space-y-1.5">
              <div className="flex justify-between">
                <span>Net recovered:</span>
                <strong className="text-slate-900">₹{activeTier.controlRecovered.toLocaleString('en-IN')}</strong>
              </div>
              <div className="flex justify-between">
                <span>Unit cost:</span>
                <strong className="text-slate-900">₹0.25 / txn</strong>
              </div>
            </div>
          </motion.div>

          {/* Card 2: Variant Arm (50% Traffic) */}
          <motion.div
            whileHover={{ y: -2 }}
            onMouseEnter={() => setHoveredArm('variant')}
            onMouseLeave={() => setHoveredArm(null)}
            className={`p-6 rounded-2xl border transition-all duration-200 bg-white ${
              hoveredArm === 'variant'
                ? 'border-emerald-500 shadow-md ring-1 ring-emerald-500/20'
                : 'border-slate-300 shadow-xs'
            }`}
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
              <span className="text-xs font-mono uppercase text-emerald-700 font-bold">
                Variant Group (50%)
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                WINNER (+16.6 pp)
              </span>
            </div>

            {/* Rate */}
            <div className="space-y-1">
              <div className="text-3xl font-bold font-mono text-emerald-700">
                <CountUpNumber value={activeTier.variantRate} suffix="%" decimals={1} />
              </div>
              <p className="text-xs text-slate-600">Recovery rate</p>
            </div>

            {/* Benchmark Bar */}
            <div className="my-4 space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span className="text-emerald-800 font-semibold">RecoverIQ Yield</span>
                <span className="text-emerald-700 font-bold">31.4%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: '14.8%' }}
                  animate={{ width: isSimulating ? '14.8%' : '31.4%' }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full bg-emerald-600 rounded-full"
                />
              </div>
            </div>

            {/* Metrics */}
            <div className="pt-3 border-t border-slate-100 text-xs font-mono text-slate-600 space-y-1.5">
              <div className="flex justify-between">
                <span>Net recovered:</span>
                <strong className="text-emerald-700 font-bold">
                  ₹{activeTier.variantRecovered.toLocaleString('en-IN')}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Statistical confidence:</span>
                <strong className="text-emerald-700 font-bold">99.8% (p &lt; 0.001)</strong>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom Measured Summary Banner */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-700">
              Measured lift on <strong>{activeTier.label}</strong> cohort:
            </span>
            <span className="font-mono font-bold text-emerald-700 text-sm">
              +₹{activeTier.liftAmount.toLocaleString('en-IN')} net recovered revenue
            </span>
          </div>

          <MagneticButton maxDistance={6}>
            <Link
              href="/simulator"
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition-all flex items-center gap-1.5 shrink-0 shadow-xs hover:shadow-md cursor-pointer"
            >
              <span>Run Experiment Simulator</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </MagneticButton>
        </div>
      </div>
    </section>
  );
}
