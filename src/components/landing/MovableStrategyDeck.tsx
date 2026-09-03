'use client';

import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Clock,
  MessageSquare,
  TrendingUp,
  UserCheck,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Layers,
  Sparkles,
} from 'lucide-react';
import CountUpNumber from './CountUpNumber';
import MagneticButton from './MagneticButton';
import Link from 'next/link';

interface StrategyStackCard {
  id: string;
  num: string;
  badge: string;
  badgeColor: string;
  name: string;
  rate: number;
  expectedAmount: string;
  cost: string;
  risk: string;
  riskColor: string;
  description: string;
  icon: any;
  cardBg: string;
  borderColor: string;
  rateColor: string;
  isWinner?: boolean;
}

const STRATEGY_STACK: StrategyStackCard[] = [
  {
    id: 'immediate',
    num: '01',
    badge: 'Baseline Default',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    name: 'Immediate Gateway Retry',
    rate: 14.8,
    expectedAmount: '₹1.62 Lakhs',
    cost: '₹0.25 / txn',
    risk: 'High switch decline rate during bank outage',
    riskColor: 'text-rose-600',
    description: 'Fires immediately upon decline webhook. Incurs non-refundable gateway processing fees on repeat CBS switch drops.',
    icon: Zap,
    cardBg: 'bg-gradient-to-br from-rose-50/80 via-white to-slate-50',
    borderColor: 'border-rose-200/90 shadow-rose-100/50',
    rateColor: 'text-slate-800',
  },
  {
    id: 'whatsapp',
    num: '02',
    badge: 'Direct Re-engagement',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    name: 'WhatsApp 1-Tap Deep Link',
    rate: 19.4,
    expectedAmount: '₹2.12 Lakhs',
    cost: '₹1.50 / txn',
    risk: 'Low customer friction',
    riskColor: 'text-blue-700',
    description: 'Instant friction-free UPI payment link sent directly to customer smartphone with a 4-minute average recovery velocity.',
    icon: MessageSquare,
    cardBg: 'bg-gradient-to-br from-blue-50/90 via-white to-sky-50/70',
    borderColor: 'border-blue-300 shadow-blue-100/60',
    rateColor: 'text-blue-700',
  },
  {
    id: 'delayed',
    num: '03',
    badge: 'Smart Off-Peak',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    name: 'Scheduled 6h Morning Retry',
    rate: 23.7,
    expectedAmount: '₹2.58 Lakhs',
    cost: '₹0.25 / txn',
    risk: 'Zero customer fatigue',
    riskColor: 'text-amber-800 font-semibold',
    description: 'Waits for banking CBS switch load to normalize before silently executing background auto-debit with zero customer friction.',
    icon: Clock,
    cardBg: 'bg-gradient-to-br from-amber-50/90 via-white to-orange-50/60',
    borderColor: 'border-amber-300 shadow-amber-100/60',
    rateColor: 'text-amber-800',
  },
  {
    id: 'review',
    num: '04',
    badge: 'High-Ticket Gate',
    badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
    name: 'Human Review Gate',
    rate: 42.0,
    expectedAmount: '₹1.08 Lakhs',
    cost: '₹15.00 / txn',
    risk: 'Protected VIP LTV',
    riskColor: 'text-purple-700 font-semibold',
    description: 'Routes high-value transactions (> ₹30,000) to merchant operations team for white-glove manual customer outreach.',
    icon: UserCheck,
    cardBg: 'bg-gradient-to-br from-purple-50/90 via-white to-indigo-50/60',
    borderColor: 'border-purple-300 shadow-purple-100/60',
    rateColor: 'text-purple-800',
  },
  {
    id: 'ai-optimized',
    num: '05',
    badge: 'RecoverIQ Optimal Winner',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold',
    name: 'RecoverIQ AI Dynamic Selection',
    rate: 31.4,
    expectedAmount: '₹3.42 Lakhs',
    cost: '₹0.85 / txn',
    risk: 'Optimal Mathematical EV',
    riskColor: 'text-emerald-400 font-bold',
    description: 'Dynamically orchestrates across all rails and off-peak windows, maximizing Expected Value and eliminating unnecessary decline fees.',
    icon: TrendingUp,
    cardBg: 'bg-gradient-to-br from-[#0a0f1d] via-[#0d1629] to-[#062019]',
    borderColor: 'border-emerald-500/60 shadow-emerald-950/60 ring-1 ring-emerald-500/30',
    rateColor: 'text-emerald-400',
    isWinner: true,
  },
];

export default function MovableStrategyDeck() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [manualCardIdx, setManualCardIdx] = useState<number | null>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Track active layer based on scroll progress (5 stages: 0-20%, 20-40%, 40-60%, 60-80%, 80-100%)
  useEffect(() => {
    const unsubscribe = scrollYProgress.on('change', (v) => {
      if (manualCardIdx !== null) return;
      if (v < 0.20) setActiveStep(0);
      else if (v < 0.40) setActiveStep(1);
      else if (v < 0.60) setActiveStep(2);
      else if (v < 0.80) setActiveStep(3);
      else setActiveStep(4);
    });
    return () => unsubscribe();
  }, [scrollYProgress, manualCardIdx]);

  const currentIdx = manualCardIdx !== null ? manualCardIdx : activeStep;

  return (
    <section id="strategies-deck" ref={containerRef} className="relative bg-white border-t border-slate-200">
      {/* Balanced 240vh scroll track for smooth equal pacing across all 5 cards */}
      <div className="h-[240vh] relative">
        {/* Sticky 100vh Viewport */}
        <div className="sticky top-0 h-screen w-full flex flex-col justify-between py-10 px-6 lg:px-12 overflow-hidden select-none">
          <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col justify-between">
            {/* Header */}
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-mono text-slate-700 shadow-xs">
                <Layers className="w-3.5 h-3.5 text-slate-700" />
                <span>One-Over-One Strategy Stacking</span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                Compare recovery strategies layer by layer.
              </h2>
              <p className="text-xs sm:text-sm text-slate-600">
                Scroll to stack candidate channels one over one and observe how Expected Value builds progressively.
              </p>

              {/* Direct Interactive Stage Switcher Pills */}
              <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
                {STRATEGY_STACK.map((card, idx) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => {
                      setManualCardIdx(idx);
                      setTimeout(() => setManualCardIdx(null), 3000);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                      currentIdx === idx
                        ? card.isWinner
                          ? 'bg-slate-900 text-emerald-400 font-bold shadow-md scale-105 ring-2 ring-emerald-500/30'
                          : 'bg-slate-900 text-white font-bold shadow-md scale-105'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>{card.num}</span>
                    <span>{card.name.split(' ')[0]}</span>
                    {currentIdx === idx && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Central Stacked Cards Deck Arena ("One Over One") with 3D Perspective */}
            <div
              className="relative flex-1 flex items-center justify-center my-6"
              style={{ perspective: 1200 }}
            >
              <div className="relative w-full max-w-xl h-[360px] sm:h-[330px] flex items-center justify-center">
                {STRATEGY_STACK.map((card, idx) => {
                  const Icon = card.icon;
                  const diff = idx - currentIdx;

                  // 3D Stacking Transform Physics:
                  let targetY = 0;
                  let targetScale = 1;
                  let targetOpacity = 1;
                  let targetRotateX = 0;
                  let targetRotateZ = 0;
                  let targetZIndex = 10 + idx;

                  if (diff < 0) {
                    // Layered underneath in stack
                    targetY = diff * 22; // shift up
                    targetScale = 1 + diff * 0.045; // scale down
                    targetOpacity = Math.max(0.35, 1 + diff * 0.22);
                    targetRotateX = diff * 2;
                    targetRotateZ = diff * 1.2;
                    targetZIndex = 10 + idx;
                  } else if (diff === 0) {
                    // Active top card
                    targetY = 0;
                    targetScale = 1;
                    targetOpacity = 1;
                    targetRotateX = 0;
                    targetRotateZ = 0;
                    targetZIndex = 30;
                  } else {
                    // Ahead in scroll queue (slides in from bottom)
                    targetY = 240;
                    targetScale = 0.92;
                    targetOpacity = 0;
                    targetRotateX = -12;
                    targetRotateZ = 2;
                    targetZIndex = 5;
                  }

                  return (
                    <motion.div
                      key={card.id}
                      animate={{
                        y: targetY,
                        scale: targetScale,
                        opacity: targetOpacity,
                        rotateX: targetRotateX,
                        rotateZ: targetRotateZ,
                        zIndex: targetZIndex,
                      }}
                      transition={{
                        type: 'spring',
                        stiffness: 420,
                        damping: 24,
                        mass: 0.45,
                      }}
                      className={`absolute inset-0 p-6 sm:p-7 rounded-3xl border-2 transition-all shadow-xl ${card.cardBg} ${card.borderColor} ${
                        diff === 0 ? 'ring-2 ring-slate-900/5' : ''
                      }`}
                    >
                      {/* Top Bar: Num, Distinct Badge, Icon */}
                      <div
                        className={`flex items-center justify-between border-b pb-3 mb-4 ${
                          card.isWinner ? 'border-slate-800' : 'border-slate-200/60'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold ${
                              card.isWinner
                                ? 'bg-slate-800 text-emerald-400'
                                : 'bg-white/90 text-slate-800 shadow-xs border border-slate-200'
                            }`}
                          >
                            {card.num}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border ${card.badgeColor}`}
                          >
                            {card.badge}
                          </span>
                        </div>

                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                            card.isWinner
                              ? 'bg-slate-800 text-emerald-400 ring-1 ring-emerald-500/30'
                              : 'bg-white text-slate-800 shadow-xs border border-slate-200'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                      </div>

                      {/* Main Title & Success Rate with Color Accent */}
                      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                        <h3 className={`text-lg sm:text-xl font-bold ${card.isWinner ? 'text-white' : 'text-slate-900'}`}>
                          {card.name}
                        </h3>
                        <div className="flex items-baseline gap-1">
                          <span
                            className={`text-3xl sm:text-4xl font-extrabold font-mono ${card.rateColor}`}
                          >
                            <CountUpNumber value={card.rate} suffix="%" decimals={1} />
                          </span>
                          <span className={`text-xs ${card.isWinner ? 'text-slate-400' : 'text-slate-500'}`}>
                            yield
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      <p className={`text-xs mt-2 leading-relaxed ${card.isWinner ? 'text-slate-300' : 'text-slate-600'}`}>
                        {card.description}
                      </p>

                      {/* 3 Metric Badges */}
                      <div
                        className={`mt-4 pt-3 border-t grid grid-cols-3 gap-2 text-xs font-mono ${
                          card.isWinner
                            ? 'border-slate-800 text-slate-300'
                            : 'border-slate-200/70 text-slate-600'
                        }`}
                      >
                        <div className={`p-2 rounded-xl ${card.isWinner ? 'bg-slate-900/80' : 'bg-white/70 border border-slate-100'}`}>
                          <span className={`block text-[10px] ${card.isWinner ? 'text-slate-500' : 'text-slate-400'}`}>
                            Expected Recovery
                          </span>
                          <strong className={card.isWinner ? 'text-emerald-400 text-sm' : 'text-slate-900 text-sm'}>
                            {card.expectedAmount}
                          </strong>
                        </div>

                        <div className={`p-2 rounded-xl ${card.isWinner ? 'bg-slate-900/80' : 'bg-white/70 border border-slate-100'}`}>
                          <span className={`block text-[10px] ${card.isWinner ? 'text-slate-500' : 'text-slate-400'}`}>
                            Intervention Cost
                          </span>
                          <strong className={card.isWinner ? 'text-white text-sm' : 'text-slate-900 text-sm'}>
                            {card.cost}
                          </strong>
                        </div>

                        <div className={`p-2 rounded-xl ${card.isWinner ? 'bg-slate-900/80' : 'bg-white/70 border border-slate-100'}`}>
                          <span className={`block text-[10px] ${card.isWinner ? 'text-slate-500' : 'text-slate-400'}`}>
                            Risk Assessment
                          </span>
                          <span className={`truncate block font-semibold text-xs mt-0.5 ${card.riskColor}`}>
                            {card.risk}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Winner Callout Bar */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-slate-700">
                  {currentIdx === 4 ? (
                    <>
                      <strong>RecoverIQ AI Winner:</strong> Delivers <strong>+16.6 pp Net Lift</strong> (+₹1,80,000/mo) on ₹25L cohort compared to baseline.
                    </>
                  ) : (
                    <>
                      Viewing strategy <strong>0{currentIdx + 1} of 05</strong>. Scroll to stack higher-yield channels.
                    </>
                  )}
                </span>
              </div>

              <MagneticButton maxDistance={6}>
                <Link
                  href="/simulator"
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition-all flex items-center gap-1.5 shrink-0 shadow-xs hover:shadow-md cursor-pointer"
                >
                  <span>Simulate in Workbench</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </MagneticButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
