'use client';

import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  Clock,
  MessageSquare,
  RefreshCw,
  Ban,
  TrendingUp,
  ShieldCheck,
  Zap,
  ArrowRight,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import CountUpNumber from './CountUpNumber';
import MagneticButton from './MagneticButton';
import Link from 'next/link';

interface TransactionStory {
  id: string;
  name: string;
  initials: string;
  method: string;
  amount: number;
  initialFailure: string;
  strategyName: string;
  strategyBadge: string;
  strategyBadgeColor: string;
  strategyIcon: any;
  prob: number;
  ev: number;
  cost: number;
  actionNote: string;
  isSuppressed?: boolean;
}

const TRANSACTIONS: TransactionStory[] = [
  {
    id: 'txn-1',
    name: 'Rahul Kumar',
    initials: 'RK',
    method: 'UPI Auto-pay',
    amount: 18500,
    initialFailure: 'Switch timeout (504)',
    strategyName: 'Scheduled 10 AM Retry',
    strategyBadge: 'Scheduled Retry',
    strategyBadgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    strategyIcon: Clock,
    prob: 91,
    ev: 16835,
    cost: 0.25,
    actionNote: 'Temporary bank CBS lag. Scheduled silent off-peak retry.',
  },
  {
    id: 'txn-2',
    name: 'Priya Sharma',
    initials: 'PS',
    method: 'Credit Card',
    amount: 7200,
    initialFailure: '3DS OTP drop-off',
    strategyName: 'WhatsApp 1-Tap Link',
    strategyBadge: 'Customer Nudge',
    strategyBadgeColor: 'bg-blue-50 text-blue-800 border-blue-200',
    strategyIcon: MessageSquare,
    prob: 68,
    ev: 4896,
    cost: 1.5,
    actionNote: 'Authentication abandoned. Sent instant 1-tap payment link.',
  },
  {
    id: 'txn-3',
    name: 'Amit Patel',
    initials: 'AP',
    method: 'e-Mandate',
    amount: 12900,
    initialFailure: 'Authorization expired',
    strategyName: '1-Click Mandate Re-auth',
    strategyBadge: 'Mandate Update',
    strategyBadgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
    strategyIcon: RefreshCw,
    prob: 74,
    ev: 9546,
    cost: 0.85,
    actionNote: 'Mandate expired. Dispatched self-serve re-authorization flow.',
  },
  {
    id: 'txn-4',
    name: 'Vikram Singh',
    initials: 'VS',
    method: 'Corporate Card',
    amount: 28000,
    initialFailure: 'Stolen / Hotlisted card',
    strategyName: 'DO NOT RETRY',
    strategyBadge: 'Suppressed',
    strategyBadgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
    strategyIcon: Ban,
    prob: 0,
    ev: 0,
    cost: 0.0,
    actionNote: 'Permanent hard decline. Retries suppressed to avoid merchant fees.',
    isSuppressed: true,
  },
];

export default function PaymentLifecycleStory() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState<number>(1);
  const [manualStage, setManualStage] = useState<number | null>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Track progress stages across 5 well-defined scroll slices
  useEffect(() => {
    const unsubscribe = scrollYProgress.on('change', (val) => {
      if (manualStage !== null) return;
      if (val < 0.20) setActiveStage(1); // Ingest
      else if (val < 0.40) setActiveStage(2); // Converge
      else if (val < 0.60) setActiveStage(3); // Analyze
      else if (val < 0.78) setActiveStage(4); // Branch
      else setActiveStage(5); // ONLY Result Graph
    });

    return () => unsubscribe();
  }, [scrollYProgress, manualStage]);

  const currentStage = manualStage !== null ? manualStage : activeStage;

  // Transform coordinates for each card across Phases 1–4
  const card1X = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.78], [-180, -120, 0, 0, -200]);
  const card1Y = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.78], [-70, -30, 0, 0, -75]);
  const card1Rotate = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.78], [-3, -1, 0, 0, -2]);
  const card1Scale = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.78], [0.95, 1, 0.9, 0.9, 1]);

  const card2X = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.78], [180, 120, 0, 0, 200]);
  const card2Y = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.78], [-70, -30, 0, 0, -75]);
  const card2Rotate = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.78], [3, 1, 0, 0, 2]);
  const card2Scale = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.78], [0.95, 1, 0.9, 0.9, 1]);

  const card3X = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.78], [-180, -120, 0, 0, -200]);
  const card3Y = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.78], [70, 30, 0, 0, 75]);
  const card3Rotate = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.78], [2, 0.5, 0, 0, -1.5]);
  const card3Scale = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.78], [0.95, 1, 0.9, 0.9, 1]);

  const card4X = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.78], [180, 120, 0, 0, 200]);
  const card4Y = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.78], [70, 30, 0, 0, 75]);
  const card4Rotate = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.78], [-2, -0.5, 0, 0, 1.5]);
  const card4Scale = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.78], [0.95, 1, 0.9, 0.9, 1]);

  // Central Engine Opacity & Scale for Phases 1–4
  const engineScale = useTransform(scrollYProgress, [0.15, 0.35, 0.65, 0.76], [0.85, 1, 1, 0.85]);
  const engineOpacity = useTransform(scrollYProgress, [0.15, 0.3, 0.70, 0.76], [0.3, 1, 1, 0]);

  // Minimal chart path drawing for Phase 5
  const chartPathLength = useTransform(scrollYProgress, [0.78, 0.96], [0, 1]);
  const baselineChartPathLength = useTransform(scrollYProgress, [0.76, 0.88], [0, 1]);

  const cardTransforms = [
    { x: card1X, y: card1Y, rotate: card1Rotate, scale: card1Scale },
    { x: card2X, y: card2Y, rotate: card2Rotate, scale: card2Scale },
    { x: card3X, y: card3Y, rotate: card3Rotate, scale: card3Scale },
    { x: card4X, y: card4Y, rotate: card4Rotate, scale: card4Scale },
  ];

  return (
    <section ref={containerRef} className="relative bg-slate-50 border-t border-slate-200">
      {/* 200vh track for clean, responsive scroll control */}
      <div className="h-[200vh] relative">
        {/* Pinned 100vh Viewport */}
        <div className="sticky top-0 h-screen w-full flex flex-col justify-between py-10 px-6 lg:px-12 overflow-hidden select-none">
          <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col justify-between">
            {/* Minimal Header with Dynamic State */}
            <div className="text-center max-w-2xl mx-auto space-y-2 pt-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-mono text-slate-700 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Recovery performance</span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight transition-all duration-300">
                {currentStage < 5 ? (
                  'One failed payment can take multiple paths.'
                ) : (
                  'Recovery outcomes improve when timing becomes intelligent.'
                )}
              </h2>

              <p className="text-xs sm:text-sm text-slate-600">
                {currentStage < 5 ? (
                  'Scroll to observe how different failure reasons get diagnosed, simulated, and routed.'
                ) : (
                  'Compare naive retries against RecoverIQ intelligence on live payment cohorts.'
                )}
              </p>

              {/* Interactive Stage Switcher Pills */}
              <div className="flex items-center justify-center gap-1.5 pt-2 flex-wrap text-xs font-mono">
                {[
                  { id: 1, label: '1. Ingest' },
                  { id: 2, label: '2. Converge' },
                  { id: 3, label: '3. Analyze' },
                  { id: 4, label: '4. Branch' },
                  { id: 5, label: '5. Recovery Graph' },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setManualStage(st.id);
                      setTimeout(() => setManualStage(null), 3000);
                    }}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      currentStage === st.id
                        ? st.id === 5
                          ? 'bg-slate-900 text-emerald-400 font-bold shadow-xs'
                          : 'bg-slate-900 text-white font-bold shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content Area: Switches completely between Storyboard (Phases 1-4) and Graph (Phase 5) */}
            <div className="relative flex-1 flex items-center justify-center my-4">
              {/* Phases 1–4: Transaction Cards & Decision Engine */}
              {currentStage < 5 && (
                <div className="relative w-full h-full flex items-center justify-center">
                  {/* Central Recovery Engine Hub */}
                  <motion.div
                    style={{
                      scale: engineScale,
                      opacity: engineOpacity,
                    }}
                    className="relative z-10 w-[300px] sm:w-[360px] p-5 rounded-2xl bg-white border-2 border-slate-900 shadow-md text-center space-y-3"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-slate-900 flex items-center justify-center text-white">
                        <Zap className="w-3.5 h-3.5 fill-white" />
                      </div>
                      <span className="font-bold text-xs tracking-tight text-slate-900 uppercase font-mono">
                        RecoverIQ Decision Engine
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 font-mono">
                      {currentStage < 3 && 'Awaiting transaction stream...'}
                      {currentStage === 3 && 'Evaluating decision factors in 12ms...'}
                      {currentStage >= 4 && '4 Strategies Dispatched'}
                    </div>

                    {/* 4 Analysis Factors */}
                    <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono pt-1 text-left">
                      <div
                        className={`p-2 rounded border transition-all duration-300 ${
                          currentStage >= 3
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold'
                            : 'bg-slate-50 text-slate-400 border-slate-200'
                        }`}
                      >
                        {currentStage >= 3 ? '✓' : '•'} Failure pattern
                      </div>
                      <div
                        className={`p-2 rounded border transition-all duration-300 ${
                          currentStage >= 3
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold'
                            : 'bg-slate-50 text-slate-400 border-slate-200'
                        }`}
                      >
                        {currentStage >= 3 ? '✓' : '•'} Customer history
                      </div>
                      <div
                        className={`p-2 rounded border transition-all duration-300 ${
                          currentStage >= 3
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold'
                            : 'bg-slate-50 text-slate-400 border-slate-200'
                        }`}
                      >
                        {currentStage >= 3 ? '✓' : '•'} Recovery probability
                      </div>
                      <div
                        className={`p-2 rounded border transition-all duration-300 ${
                          currentStage >= 3
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold'
                            : 'bg-slate-50 text-slate-400 border-slate-200'
                        }`}
                      >
                        {currentStage >= 3 ? '✓' : '•'} Intervention cost
                      </div>
                    </div>
                  </motion.div>

                  {/* 4 Transaction Cards */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {TRANSACTIONS.map((txn, idx) => {
                      const t = cardTransforms[idx];
                      const Icon = txn.strategyIcon;
                      const isHovered = hoveredCard === txn.id;

                      return (
                        <motion.div
                          key={txn.id}
                          style={{
                            x: t.x,
                            y: t.y,
                            rotate: t.rotate,
                            scale: t.scale,
                          }}
                          onMouseEnter={() => setHoveredCard(txn.id)}
                          onMouseLeave={() => setHoveredCard(null)}
                          className={`pointer-events-auto absolute w-[260px] sm:w-[290px] p-4 rounded-xl border transition-shadow duration-200 cursor-pointer ${
                            isHovered
                              ? 'shadow-lg border-slate-400 bg-white -translate-y-1 z-30'
                              : 'shadow-xs border-slate-200/90 bg-white/95 z-20'
                          }`}
                        >
                          {/* Top Bar */}
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-mono font-bold text-[10px] text-slate-700">
                                {txn.initials}
                              </div>
                              <div>
                                <span className="text-xs font-semibold text-slate-900 block leading-tight">
                                  {txn.name}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400 block">
                                  {txn.method}
                                </span>
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="text-xs font-bold font-mono text-slate-900">
                                ₹{txn.amount.toLocaleString('en-IN')}
                              </span>
                            </div>
                          </div>

                          {/* Content */}
                          {currentStage < 4 ? (
                            <div className="space-y-1 text-xs">
                              <div className="flex items-center gap-1 text-rose-700 font-mono text-[10px] font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                <span>Payment Failed</span>
                              </div>
                              <p className="text-[11px] text-slate-600 truncate leading-snug">
                                {txn.initialFailure}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2 text-xs">
                              <div className="flex items-center justify-between">
                                <span
                                  className={`text-[9px] font-mono px-2 py-0.5 rounded border font-semibold ${txn.strategyBadgeColor}`}
                                >
                                  {txn.strategyBadge}
                                </span>
                                <span className="text-[10px] font-mono font-bold text-slate-900">
                                  {txn.isSuppressed ? '0%' : `${txn.prob}%`} odds
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 font-semibold text-slate-900 text-xs">
                                <Icon className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                                <span className="truncate">{txn.strategyName}</span>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Phase 5 ONLY: The Clean Performance Comparison Graph */}
              {currentStage === 5 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="w-full max-w-4xl p-6 md:p-8 rounded-3xl bg-white border border-slate-200 shadow-xl space-y-6"
                >
                  {/* 2-Arm Comparison Metric Strip */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-slate-100 pb-5">
                    {/* Naive Retry */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                      <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                        Naive Fixed Retry
                      </span>
                      <div className="text-2xl font-bold font-mono text-slate-800">14.8%</div>
                      <p className="text-[11px] text-slate-500">Standard gateway default logic</p>
                    </div>

                    {/* RecoverIQ AI */}
                    <div className="p-4 rounded-2xl bg-slate-900 text-white border border-slate-800 space-y-1 shadow-sm">
                      <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold block">
                        RecoverIQ Orchestration
                      </span>
                      <div className="text-2xl font-bold font-mono text-emerald-400">31.4%</div>
                      <p className="text-[11px] text-slate-400">Multi-rail routing + timing</p>
                    </div>

                    {/* Net Difference */}
                    <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 space-y-1 flex flex-col justify-center">
                      <span className="text-[10px] font-mono uppercase text-emerald-800 font-bold block">
                        Incremental Revenue Lift
                      </span>
                      <div className="text-2xl font-extrabold font-mono text-emerald-900">
                        +16.6 pp
                      </div>
                      <p className="text-[11px] font-mono text-emerald-700">
                        +₹4,15,000 / month on ₹25L cohort
                      </p>
                    </div>
                  </div>

                  {/* SVG Line Graph Trajectory */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono text-slate-500">
                      <span>Cohort Recovery Trajectory (0h → 24h)</span>
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-0.5 bg-slate-400" /> Naive (14.8%)
                        </span>
                        <span className="flex items-center gap-1.5 font-bold text-emerald-700">
                          <span className="w-2.5 h-0.5 bg-emerald-600" /> RecoverIQ (31.4%)
                        </span>
                      </div>
                    </div>

                    {/* 130px height SVG Canvas */}
                    <div className="w-full h-32 relative bg-slate-50/50 rounded-xl p-2 border border-slate-100">
                      <svg viewBox="0 0 600 100" className="w-full h-full select-none">
                        {/* Grid lines */}
                        <line x1="0" y1="20" x2="600" y2="20" stroke="#e2e8f0" strokeDasharray="3 3" />
                        <line x1="0" y1="60" x2="600" y2="60" stroke="#e2e8f0" strokeDasharray="3 3" />

                        {/* Naive Line (Dashed Slate) */}
                        <motion.path
                          d="M 20 80 L 120 72 L 240 68 L 360 65 L 480 63 L 580 62"
                          fill="none"
                          stroke="#94a3b8"
                          strokeWidth="2.5"
                          strokeDasharray="4 4"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                        />

                        {/* RecoverIQ AI Line (Solid Emerald) */}
                        <motion.path
                          d="M 20 80 L 120 55 L 240 38 L 360 25 L 480 18 L 580 15"
                          fill="none"
                          stroke="#059669"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 1.1, delay: 0.2, ease: 'easeOut' }}
                        />

                        {/* Result Dots */}
                        <circle cx="580" cy="62" r="3.5" fill="#94a3b8" />
                        <circle cx="580" cy="15" r="5" fill="#059669" stroke="#ffffff" strokeWidth="2.5" />
                      </svg>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Bottom Navigation Prompt */}
            <div className="text-center text-xs font-mono text-slate-400 pb-2">
              {currentStage < 5 ? (
                <span>Scroll or click &quot;5. Recovery Graph&quot; to see final cohort outcomes ↓</span>
              ) : (
                <span>Scroll down to inspect intelligent suppression guardrails ↓</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
