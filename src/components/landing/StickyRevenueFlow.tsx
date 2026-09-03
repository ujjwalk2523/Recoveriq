'use client';

import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  BrainCircuit,
  SlidersHorizontal,
  CheckCircle2,
  TrendingUp,
  Activity,
  Radio,
  Clock,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import CountUpNumber from './CountUpNumber';

interface FlowStage {
  id: number;
  name: string;
  tag: string;
  range: [number, number];
  title: string;
  description: string;
  badge: string;
}

const FLOW_STAGES: FlowStage[] = [
  {
    id: 1,
    name: 'REVENUE AT RISK',
    tag: 'Ingestion & Telemetry',
    range: [0, 0.16],
    title: 'Instant failure capture on live payment rails',
    description:
      'The moment an NPCI or Razorpay webhook drops with a decline code, RecoverIQ intercepts the payload, verifies cryptographic SHA-256 signatures, and initializes the deterministic recovery lifecycle.',
    badge: 'Stage 01: Ingestion',
  },
  {
    id: 2,
    name: 'DIAGNOSE',
    tag: 'Root Cause AI',
    range: [0.16, 0.33],
    title: 'Deterministic root-cause classification in 12ms',
    description:
      'Categorizes failure across 7 distinct banking axes: CBS switch timeouts, 3DS authentication abandonment, insufficient balance, or card hotlisting.',
    badge: 'Stage 02: Classification',
  },
  {
    id: 3,
    name: 'PREDICT',
    tag: 'ML Behavioral Scoring',
    range: [0.33, 0.50],
    title: 'Predict recovery likelihood per customer instrument',
    description:
      'Calculates exact success probability by evaluating banking hour switch health, customer lifetime value (LTV), past attempt velocity, and issuer downtime patterns.',
    badge: 'Stage 03: ML Probability',
  },
  {
    id: 4,
    name: 'SIMULATE',
    tag: 'Multi-Rail Yield Modeling',
    range: [0.50, 0.66],
    title: 'Simulate yields across candidate recovery channels',
    description:
      'Compares Expected Net Recovery across 6 candidate actions: immediate retry, off-peak morning debit, 1-tap WhatsApp nudge, or ops review gate.',
    badge: 'Stage 04: Simulation',
  },
  {
    id: 5,
    name: 'OPTIMIZE',
    tag: 'Expected Value Maximizer',
    range: [0.66, 0.83],
    title: 'Select mathematically optimal recovery action',
    description:
      'Maximizes Expected Value equation: EV = (P_success × Amount) - Unit_Cost - Fatigue_Penalty. Rejects negative-EV retries to protect merchant margins.',
    badge: 'Stage 05: Optimization',
  },
  {
    id: 6,
    name: 'RECOVER',
    tag: 'Autonomous Dispatch & Ledger',
    range: [0.83, 1.0],
    title: 'Autonomous execution with immutable audit trail',
    description:
      'Executes the winning strategy with zero duplicate debit guarantees, reconciles settlement with merchant ledger, and feeds back into behavioral scoring models.',
    badge: 'Stage 06: Settlement',
  },
];

export default function StickyRevenueFlow() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentStageIdx, setCurrentStageIdx] = useState<number>(0);
  const [manualOverrideIdx, setManualOverrideIdx] = useState<number | null>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Track active stage based on scroll progress
  useEffect(() => {
    const unsubscribe = scrollYProgress.on('change', (latest) => {
      if (manualOverrideIdx !== null) return;
      let activeIndex = 0;
      if (latest < 0.16) activeIndex = 0;
      else if (latest < 0.33) activeIndex = 1;
      else if (latest < 0.50) activeIndex = 2;
      else if (latest < 0.66) activeIndex = 3;
      else if (latest < 0.83) activeIndex = 4;
      else activeIndex = 5;

      setCurrentStageIdx(activeIndex);
    });

    return () => unsubscribe();
  }, [scrollYProgress, manualOverrideIdx]);

  const activeIdx = manualOverrideIdx !== null ? manualOverrideIdx : currentStageIdx;
  const stage = FLOW_STAGES[activeIdx];

  return (
    <div id="how-it-works" ref={containerRef} className="relative bg-slate-50 border-t border-slate-200">
      {/* Fast, snappy 170vh scroll track */}
      <div className="h-[170vh] relative">
        {/* Sticky Pinned Viewport Container */}
        <div className="sticky top-0 h-screen w-full flex flex-col justify-center py-10 px-6 lg:px-12 overflow-hidden">
          <div className="max-w-6xl mx-auto w-full space-y-8">
            {/* Header / Intro */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-mono uppercase tracking-wider text-slate-500 font-bold">
                    Scroll-Driven Recovery Pipeline
                  </span>
                </div>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-1">
                  How RecoverIQ routes every transaction
                </h2>
              </div>

              {/* Connected Stage Pills for direct navigation */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {FLOW_STAGES.map((st, i) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setManualOverrideIdx(i);
                      setTimeout(() => setManualOverrideIdx(null), 3000);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer whitespace-nowrap ${
                      activeIdx === i
                        ? 'bg-slate-900 text-white font-bold shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    0{st.id} {st.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Main Interactive Stage Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left Column: Stage Narrative (4 cols) */}
              <div className="lg:col-span-5 space-y-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={stage.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="space-y-4"
                  >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/80 text-slate-800 font-mono text-xs font-bold">
                      <span>{stage.badge}</span>
                      <span className="text-slate-400">•</span>
                      <span>{stage.tag}</span>
                    </div>

                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
                      {stage.title}
                    </h3>

                    <p className="text-sm text-slate-600 leading-relaxed">
                      {stage.description}
                    </p>

                    {/* Stage specific quick metrics */}
                    <div className="pt-2">
                      {stage.id === 1 && (
                        <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs font-mono flex justify-between items-center">
                          <span className="text-slate-500">Telemetry Ingestion:</span>
                          <span className="text-slate-900 font-bold">480ms Latency Capture</span>
                        </div>
                      )}
                      {stage.id === 2 && (
                        <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs font-mono flex justify-between items-center">
                          <span className="text-slate-500">Classification Certainty:</span>
                          <span className="text-emerald-700 font-bold">94% Confidence</span>
                        </div>
                      )}
                      {stage.id === 3 && (
                        <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs font-mono flex justify-between items-center">
                          <span className="text-slate-500">Recovery Likelihood:</span>
                          <span className="text-emerald-700 font-bold">91% Probability</span>
                        </div>
                      )}
                      {stage.id === 4 && (
                        <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs font-mono flex justify-between items-center">
                          <span className="text-slate-500">Channels Evaluated:</span>
                          <span className="text-slate-900 font-bold">6 Recovery Rails</span>
                        </div>
                      )}
                      {stage.id === 5 && (
                        <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs font-mono flex justify-between items-center">
                          <span className="text-slate-500">Optimal Expected Value:</span>
                          <span className="text-emerald-700 font-bold">₹16,835 Net Yield</span>
                        </div>
                      )}
                      {stage.id === 6 && (
                        <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs font-mono flex justify-between items-center">
                          <span className="text-slate-500">Captured Revenue:</span>
                          <span className="text-emerald-700 font-bold">₹18,500 Reconciled</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Visual Pipeline Progress Line */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-[11px] font-mono text-slate-400">
                    <span>Progress: Stage {activeIdx + 1} of 6</span>
                    <span>{Math.round(((activeIdx + 1) / 6) * 100)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-slate-900 rounded-full"
                      animate={{ width: `${((activeIdx + 1) / 6) * 100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Dynamic Stage Visualizer (7 cols) */}
              <div className="lg:col-span-7">
                <div className="p-6 md:p-8 rounded-2xl bg-white border border-slate-200 shadow-md transition-all duration-300">
                  <AnimatePresence mode="wait">
                    {/* Stage 1: Revenue at Risk */}
                    {activeIdx === 0 && (
                      <motion.div
                        key="stage-1"
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.25 }}
                        className="space-y-4"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2">
                            <Radio className="w-4 h-4 text-rose-600 animate-pulse" />
                            <span className="text-xs font-bold text-slate-900">Webhook Intercepted</span>
                          </div>
                          <span className="text-[11px] font-mono bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-200 font-bold">
                            Failed Transaction Captured
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <span className="text-slate-400 block text-[10px]">Payment Reference</span>
                            <strong className="text-slate-900 text-sm">pay_Hdfc93819</strong>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <span className="text-slate-400 block text-[10px]">Amount At Risk</span>
                            <strong className="text-slate-900 text-sm">₹18,500 INR</strong>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <span className="text-slate-400 block text-[10px]">Payment Method</span>
                            <strong className="text-slate-900 text-sm">HDFC UPI Auto-pay</strong>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <span className="text-slate-400 block text-[10px]">Bank Switch Response</span>
                            <strong className="text-rose-700 text-sm">HTTP 504 (Timeout)</strong>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Stage 2: Diagnose */}
                    {activeIdx === 1 && (
                      <motion.div
                        key="stage-2"
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.25 }}
                        className="space-y-4"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-bold text-slate-900">Failure Diagnostics</span>
                          </div>
                          <span className="text-[11px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 font-bold">
                            Root Cause: Switch Timeout
                          </span>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-900">Issuer Switch Lag Pattern</span>
                            <span className="font-mono text-emerald-700 font-bold">94% Confidence</span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            NPCI switch telemetry indicates a temporary morning CBS synchronization spike. This is a soft technical decline—NOT an invalid card or insufficient funds.
                          </p>
                        </div>
                      </motion.div>
                    )}

                    {/* Stage 3: Predict */}
                    {activeIdx === 2 && (
                      <motion.div
                        key="stage-3"
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.25 }}
                        className="space-y-4"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2">
                            <BrainCircuit className="w-4 h-4 text-emerald-600" />
                            <span className="text-xs font-bold text-slate-900">Predictive Probability Model</span>
                          </div>
                          <span className="text-[11px] font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                            P_success = 91.0%
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <span className="text-slate-400 block text-[10px]">Customer Segment</span>
                            <strong className="text-slate-900">Enterprise VIP (Rahul S.)</strong>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <span className="text-slate-400 block text-[10px]">Customer LTV</span>
                            <strong className="text-slate-900">₹2,40,000</strong>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <span className="text-slate-400 block text-[10px]">Fatigue Index</span>
                            <strong className="text-emerald-700">18 / 100 (Safe)</strong>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <span className="text-slate-400 block text-[10px]">Optimal Time Window</span>
                            <strong className="text-slate-900">10:00 AM IST (+2h)</strong>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Stage 4: Simulate */}
                    {activeIdx === 3 && (
                      <motion.div
                        key="stage-4"
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.25 }}
                        className="space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <div className="flex items-center gap-2">
                            <SlidersHorizontal className="w-4 h-4 text-slate-700" />
                            <span className="text-xs font-bold text-slate-900">Multi-Rail Simulation</span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-500 font-bold">4 Candidates</span>
                        </div>

                        <div className="space-y-2 text-xs font-mono">
                          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex justify-between items-center">
                            <span>1. Immediate Retry</span>
                            <span className="text-slate-500">14.8% yield • ₹2,738 EV</span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-white border-2 border-slate-900 shadow-xs flex justify-between items-center font-bold">
                            <span className="text-slate-900">2. Scheduled 10 AM Retry</span>
                            <span className="text-emerald-700">91.0% yield • ₹16,835 EV</span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex justify-between items-center">
                            <span>3. WhatsApp 1-Tap Link</span>
                            <span className="text-slate-500">68.0% yield • ₹12,580 EV</span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex justify-between items-center">
                            <span>4. Suppress & Do Nothing</span>
                            <span className="text-slate-400">0.0% yield • ₹0 EV</span>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Stage 5: Optimize */}
                    {activeIdx === 4 && (
                      <motion.div
                        key="stage-5"
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.25 }}
                        className="space-y-4"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-600" />
                            <span className="text-xs font-bold text-slate-900">Optimization Result</span>
                          </div>
                          <span className="text-[11px] font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                            EV Maximized
                          </span>
                        </div>

                        <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2">
                          <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">
                            Winning Strategy Selected
                          </span>
                          <div className="text-base font-bold text-white">
                            Scheduled 10:00 AM Silent UPI Auto-Debit
                          </div>
                          <p className="text-xs text-slate-300 font-mono">
                            EV = (0.91 × ₹18,500) - ₹0.25 cost = <span className="text-emerald-400 font-bold">₹16,835 Net</span>
                          </p>
                        </div>
                      </motion.div>
                    )}

                    {/* Stage 6: Recover */}
                    {activeIdx === 5 && (
                      <motion.div
                        key="stage-6"
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.25 }}
                        className="space-y-4"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span className="text-xs font-bold text-slate-900">Settlement Captured</span>
                          </div>
                          <span className="text-[11px] font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                            SUCCESS • SHA-256 Verified
                          </span>
                        </div>

                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5 font-mono text-xs">
                          <div className="flex justify-between">
                            <span className="text-emerald-800 font-semibold">Recovered Capital:</span>
                            <span className="text-emerald-900 font-extrabold text-sm">₹18,500.00 INR</span>
                          </div>
                          <div className="flex justify-between text-[11px] text-emerald-700">
                            <span>Zero Customer Friction:</span>
                            <span>No notification fatigue</span>
                          </div>
                          <div className="flex justify-between text-[11px] text-emerald-700">
                            <span>Audit Signature:</span>
                            <span>hash_e79c04a821df</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
