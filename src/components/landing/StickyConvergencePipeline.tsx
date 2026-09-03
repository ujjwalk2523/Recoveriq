'use client';

import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Clock,
  MessageSquare,
  RefreshCw,
  UserCheck,
  Ban,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Sliders,
  Sparkles,
} from 'lucide-react';
import CountUpNumber from './CountUpNumber';

interface PipelineCard {
  id: string;
  amount: string;
  method: string;
  failure: string;
  initialPos: { x: number; y: number; rotate: number };
  strategy: string;
  prob: string;
  ev: string;
  badge: string;
  badgeColor: string;
  icon: any;
  branchPos: { x: number; y: number; rotate: number };
  isWinning?: boolean;
}

const PIPELINE_CARDS: PipelineCard[] = [
  {
    id: 'c1',
    amount: '₹18,500',
    method: 'UPI Auto-pay',
    failure: 'Switch timeout (504)',
    initialPos: { x: -260, y: -90, rotate: -4 },
    strategy: 'Scheduled 10 AM Retry',
    prob: '91%',
    ev: '₹16,835',
    badge: 'DELAYED RETRY',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    icon: Clock,
    branchPos: { x: -240, y: -80, rotate: -2 },
    isWinning: true,
  },
  {
    id: 'c2',
    amount: '₹7,200',
    method: 'Credit Card',
    failure: '3DS OTP drop-off',
    initialPos: { x: 260, y: -90, rotate: 4 },
    strategy: 'WhatsApp 1-Tap Link',
    prob: '68%',
    ev: '₹4,896',
    badge: 'CUSTOMER REMINDER',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
    icon: MessageSquare,
    branchPos: { x: 240, y: -80, rotate: 2 },
  },
  {
    id: 'c3',
    amount: '₹12,900',
    method: 'e-Mandate',
    failure: 'Mandate expired',
    initialPos: { x: -260, y: 90, rotate: 3 },
    strategy: '1-Click Mandate Re-auth',
    prob: '74%',
    ev: '₹9,546',
    badge: 'MANDATE UPDATE',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    icon: RefreshCw,
    branchPos: { x: -240, y: 80, rotate: -1.5 },
  },
  {
    id: 'c4',
    amount: '₹28,000',
    method: 'Corporate Card',
    failure: 'Hotlisted / Decline 05',
    initialPos: { x: 260, y: 90, rotate: -3 },
    strategy: 'DO NOT RETRY (Suppressed)',
    prob: '0%',
    ev: '₹1,500 Saved',
    badge: 'DO NOT RECOVER',
    badgeColor: 'bg-slate-200 text-slate-800 border-slate-300',
    icon: Ban,
    branchPos: { x: 240, y: 80, rotate: 1.5 },
  },
];

export default function StickyConvergencePipeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeStage, setActiveStage] = useState<number>(1);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  useEffect(() => {
    const unsubscribe = scrollYProgress.on('change', (v) => {
      if (v < 0.20) setActiveStage(1); // 0-20% Ingest
      else if (v < 0.40) setActiveStage(2); // 20-40% Converge
      else if (v < 0.60) setActiveStage(3); // 40-60% Analyze
      else if (v < 0.80) setActiveStage(4); // 60-80% Branch
      else setActiveStage(5); // 80-100% Winning Action
    });
    return () => unsubscribe();
  }, [scrollYProgress]);

  // Card Transforms:
  // Card 1
  const c1X = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.8, 1], [-260, -260, 0, 0, -240, -240]);
  const c1Y = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.8, 1], [-90, -90, 0, 0, -80, -80]);
  const c1Rotate = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.8, 1], [-4, -4, 0, 0, -2, -2]);
  const c1Scale = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.8, 1], [0.95, 1, 0.88, 0.88, 1.04, 1.04]);

  // Card 2
  const c2X = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.8, 1], [260, 260, 0, 0, 240, 240]);
  const c2Y = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.8, 1], [-90, -90, 0, 0, -80, -80]);
  const c2Rotate = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.8, 1], [4, 4, 0, 0, 2, 2]);
  const c2Scale = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.8, 1], [0.95, 1, 0.88, 0.88, 1, 1]);

  // Card 3
  const c3X = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.8, 1], [-260, -260, 0, 0, -240, -240]);
  const c3Y = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.8, 1], [90, 90, 0, 0, 80, 80]);
  const c3Rotate = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.8, 1], [3, 3, 0, 0, -1.5, -1.5]);
  const c3Scale = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.8, 1], [0.95, 1, 0.88, 0.88, 1, 1]);

  // Card 4
  const c4X = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.8, 1], [260, 260, 0, 0, 240, 240]);
  const c4Y = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.8, 1], [90, 90, 0, 0, 80, 80]);
  const c4Rotate = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.8, 1], [-3, -3, 0, 0, 1.5, 1.5]);
  const c4Scale = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.8, 1], [0.95, 1, 0.88, 0.88, 1, 1]);

  const transforms = [
    { x: c1X, y: c1Y, rotate: c1Rotate, scale: c1Scale },
    { x: c2X, y: c2Y, rotate: c2Rotate, scale: c2Scale },
    { x: c3X, y: c3Y, rotate: c3Rotate, scale: c3Scale },
    { x: c4X, y: c4Y, rotate: c4Rotate, scale: c4Scale },
  ];

  return (
    <section id="how-it-works" ref={containerRef} className="relative bg-slate-50 border-t border-slate-200">
      {/* 280vh scroll track */}
      <div className="h-[280vh] relative">
        {/* Sticky 100vh Viewport */}
        <div className="sticky top-0 h-screen w-full flex flex-col justify-between py-12 px-6 lg:px-12 overflow-hidden select-none">
          <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col justify-between">
            {/* Header with Step Context */}
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-mono text-slate-700 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Deterministic Pipeline</span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                {activeStage === 1 && 'Failed payments enter the intelligence rail.'}
                {activeStage === 2 && 'Transactions converge into the central engine.'}
                {activeStage === 3 && 'Engine evaluates 4 recovery dimensions.'}
                {activeStage === 4 && 'Strategies branch out to optimal channels.'}
                {activeStage === 5 && 'Winning action executed with maximum EV.'}
              </h2>

              <p className="text-xs sm:text-sm text-slate-600">
                Scroll to see how RecoverIQ analyzes failures, prevents blind retries, and selects the highest-yield outcome.
              </p>

              {/* Progress Indicator */}
              <div className="flex items-center justify-center gap-2 pt-2 text-[11px] font-mono text-slate-400">
                <span className={activeStage >= 1 ? 'text-slate-900 font-bold' : ''}>01 Ingest</span>
                <span>→</span>
                <span className={activeStage >= 2 ? 'text-slate-900 font-bold' : ''}>02 Converge</span>
                <span>→</span>
                <span className={activeStage >= 3 ? 'text-slate-900 font-bold' : ''}>03 Analyze</span>
                <span>→</span>
                <span className={activeStage >= 4 ? 'text-slate-900 font-bold' : ''}>04 Branch</span>
                <span>→</span>
                <span className={activeStage >= 5 ? 'text-emerald-700 font-bold' : ''}>05 Recover</span>
              </div>
            </div>

            {/* Central Animated Pipeline Arena */}
            <div className="relative flex-1 flex items-center justify-center my-6">
              {/* Central Recovery Engine Hub */}
              <motion.div
                animate={{
                  scale: activeStage === 3 ? [1, 1.03, 1] : 1,
                  boxShadow: activeStage === 3
                    ? '0 12px 32px -4px rgba(15, 23, 42, 0.15)'
                    : '0 4px 12px rgba(15, 23, 42, 0.05)',
                }}
                transition={{ duration: 1.5, repeat: activeStage === 3 ? Infinity : 0 }}
                className="relative z-10 w-[300px] sm:w-[360px] p-6 rounded-2xl bg-white border-2 border-slate-900 text-center shadow-md space-y-3"
              >
                <div className="flex items-center justify-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
                    <Zap className="w-4 h-4 fill-white" />
                  </div>
                  <span className="font-bold text-xs tracking-tight text-slate-900 uppercase font-mono">
                    RecoverIQ Decision Engine
                  </span>
                </div>

                <div className="text-xs text-slate-500 font-mono">
                  {activeStage < 3 && 'Awaiting incoming payment telemetry...'}
                  {activeStage === 3 && 'Analyzing 4 failure dimensions in 12ms...'}
                  {activeStage >= 4 && 'Optimal Recovery Actions Dispatched'}
                </div>

                {/* 4 Analysis Factors (Light up in Stage 3) */}
                <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono pt-1 text-left">
                  <div
                    className={`p-2 rounded border transition-all duration-300 ${
                      activeStage >= 3
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                        : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                  >
                    {activeStage >= 3 ? '✓' : '•'} Failure pattern
                  </div>
                  <div
                    className={`p-2 rounded border transition-all duration-300 ${
                      activeStage >= 3
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                        : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                  >
                    {activeStage >= 3 ? '✓' : '•'} Customer history
                  </div>
                  <div
                    className={`p-2 rounded border transition-all duration-300 ${
                      activeStage >= 3
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                        : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                  >
                    {activeStage >= 3 ? '✓' : '•'} Recovery probability
                  </div>
                  <div
                    className={`p-2 rounded border transition-all duration-300 ${
                      activeStage >= 3
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                        : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                  >
                    {activeStage >= 3 ? '✓' : '•'} Intervention cost
                  </div>
                </div>
              </motion.div>

              {/* 4 Movable Cards */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {PIPELINE_CARDS.map((card, idx) => {
                  const t = transforms[idx];
                  const Icon = card.icon;
                  const isHovered = hoveredCard === card.id;

                  return (
                    <motion.div
                      key={card.id}
                      style={{
                        x: t.x,
                        y: t.y,
                        rotate: t.rotate,
                        scale: t.scale,
                      }}
                      onMouseEnter={() => setHoveredCard(card.id)}
                      onMouseLeave={() => setHoveredCard(null)}
                      className={`pointer-events-auto absolute w-[240px] sm:w-[270px] p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                        activeStage >= 4 && card.isWinning
                          ? 'bg-slate-900 text-white border-slate-800 shadow-xl z-30'
                          : isHovered
                          ? 'bg-white border-slate-400 shadow-lg z-30 -translate-y-1'
                          : 'bg-white border-slate-200/90 shadow-xs z-20'
                      }`}
                    >
                      {/* Top Row: Amount & Method */}
                      <div className="flex items-center justify-between border-b pb-1.5 mb-1.5 text-xs font-mono border-slate-100">
                        <span className={`font-bold ${activeStage >= 4 && card.isWinning ? 'text-white' : 'text-slate-900'}`}>
                          {card.amount}
                        </span>
                        <span className={`text-[10px] ${activeStage >= 4 && card.isWinning ? 'text-slate-300' : 'text-slate-400'}`}>
                          {card.method}
                        </span>
                      </div>

                      {/* Content: Initial Failure (Stage 1-3) vs Resolved Action (Stage 4-5) */}
                      {activeStage < 4 ? (
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-1 text-rose-700 font-mono text-[10px] font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            <span>Payment Failed</span>
                          </div>
                          <p className="text-[11px] text-slate-600 truncate">
                            {card.failure}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className={`text-[9px] font-mono px-2 py-0.5 rounded border font-semibold ${card.badgeColor}`}>
                              {card.badge}
                            </span>
                            <span className={`text-[10px] font-mono font-bold ${activeStage >= 4 && card.isWinning ? 'text-emerald-400' : 'text-slate-900'}`}>
                              {card.prob}
                            </span>
                          </div>

                          <div className={`flex items-center gap-1.5 font-semibold text-xs ${activeStage >= 4 && card.isWinning ? 'text-white' : 'text-slate-900'}`}>
                            <Icon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{card.strategy}</span>
                          </div>

                          <div className={`flex justify-between text-[10px] font-mono pt-1 border-t ${activeStage >= 4 && card.isWinning ? 'border-slate-800 text-slate-300' : 'border-slate-100 text-slate-500'}`}>
                            <span>Expected Yield:</span>
                            <strong className={activeStage >= 4 && card.isWinning ? 'text-emerald-400' : 'text-slate-900'}>
                              {card.ev}
                            </strong>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Caption */}
            <div className="text-center text-xs font-mono text-slate-400 pb-2">
              <span>Scroll to control pipeline execution progress ↓</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
