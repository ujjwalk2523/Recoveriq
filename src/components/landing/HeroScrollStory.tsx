'use client';

import React, { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Sliders,
  Zap,
  Clock,
  MessageSquare,
  Ban,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import MagneticButton from './MagneticButton';

interface LiveTxn {
  id: number;
  amount: string;
  method: string;
  failure: string;
  outcome: string;
  outcomeColor: string;
  icon: any;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

const LIVE_TXNS: LiveTxn[] = [
  {
    id: 1,
    amount: '₹18,500',
    method: 'UPI Auto-pay',
    failure: 'CBS Switch Timeout',
    outcome: 'Scheduled 10 AM Retry (91%)',
    outcomeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    icon: Clock,
    startX: -220,
    startY: -120,
    endX: -180,
    endY: 130,
  },
  {
    id: 2,
    amount: '₹7,200',
    method: 'ICICI Card',
    failure: '3DS OTP Abandoned',
    outcome: 'WhatsApp 1-Tap Link (68%)',
    outcomeColor: 'text-blue-700 bg-blue-50 border-blue-200',
    icon: MessageSquare,
    startX: 220,
    startY: -120,
    endX: 180,
    endY: 130,
  },
  {
    id: 3,
    amount: '₹28,000',
    method: 'Corporate Card',
    failure: 'Card Hotlisted (Decline 05)',
    outcome: 'DO NOT RETRY (Suppressed)',
    outcomeColor: 'text-slate-700 bg-slate-100 border-slate-300',
    icon: Ban,
    startX: 0,
    startY: -150,
    endX: 0,
    endY: 150,
  },
];

export default function HeroScrollStory() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeCycle, setActiveCycle] = useState<number>(0);

  // Mouse parallax motion values
  const mouseX = useSpring(0, { stiffness: 200, damping: 22 });
  const mouseY = useSpring(0, { stiffness: 200, damping: 22 });

  // Scroll driven transforms
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  // Hero transformations as user scrolls
  const headlineScale = useTransform(scrollYProgress, [0, 0.45], [1, 0.90]);
  const headlineY = useTransform(scrollYProgress, [0, 0.45], [0, -50]);
  const subtitleOpacity = useTransform(scrollYProgress, [0, 0.30], [1, 0]);
  const subtitleY = useTransform(scrollYProgress, [0, 0.30], [0, -25]);
  const ctaOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0]);
  const ctaY = useTransform(scrollYProgress, [0, 0.25], [0, -20]);

  // Product visualization expands, moves to center, becomes focus
  const visualScale = useTransform(scrollYProgress, [0, 0.5], [0.95, 1.05]);
  const visualY = useTransform(scrollYProgress, [0, 0.5], [0, -20]);

  // Cursor move parallax
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (typeof window === 'undefined' || window.matchMedia('(pointer: coarse)').matches) return;
    const { clientX, clientY } = e;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const deltaX = (clientX - centerX) / centerX;
    const deltaY = (clientY - centerY) / centerY;

    mouseX.set(deltaX * 8);
    mouseY.set(deltaY * 8);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  // Continuous transaction processing loop (cycle every 3.5 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveCycle((prev) => (prev + 1) % LIVE_TXNS.length);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  const currentTxn = LIVE_TXNS[activeCycle];

  return (
    <section
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative pt-24 pb-28 md:pt-32 md:pb-40 overflow-hidden"
    >
      {/* Background Grid with subtle parallax */}
      <motion.div
        style={{
          x: useTransform(mouseX, (x) => x * -0.4),
          y: useTransform(mouseY, (y) => y * -0.4),
        }}
        className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:28px_28px] pointer-events-none opacity-40 z-0"
      />

      <div className="max-w-5xl mx-auto px-6 text-center relative z-10 space-y-6">
        {/* Category Pill */}
        <motion.div
          style={{ y: subtitleY, opacity: subtitleOpacity }}
          className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white border border-slate-200 text-xs text-slate-700 shadow-xs hover:border-slate-300 transition-all cursor-default"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-medium">Revenue recovery intelligence for Indian merchants</span>
        </motion.div>

        {/* Dynamic Scaling & Translating Headline */}
        <motion.h1
          style={{
            scale: headlineScale,
            y: headlineY,
            x: mouseX,
          }}
          className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.08] max-w-4xl mx-auto origin-center transition-transform"
        >
          Recover failed payments.<br />
          <span className="text-slate-500 font-medium">With intelligence, not retries.</span>
        </motion.h1>

        {/* Subtitle with Scroll Fade */}
        <motion.p
          style={{ y: subtitleY, opacity: subtitleOpacity }}
          className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed"
        >
          RecoverIQ predicts the highest-value recovery strategy, simulates the outcome, and helps merchants recover more revenue without blindly retrying payments.
        </motion.p>

        {/* Magnetic CTAs with Scroll Fade */}
        <motion.div
          style={{ y: ctaY, opacity: ctaOpacity }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2"
        >
          <MagneticButton maxDistance={7}>
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-6 py-3 text-xs sm:text-sm font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-all flex items-center justify-center gap-2 shadow-xs hover:shadow-md cursor-pointer"
            >
              <span>Launch RecoverIQ</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </MagneticButton>

          <MagneticButton maxDistance={7}>
            <a
              href="#simulator"
              className="w-full sm:w-auto px-6 py-3 text-xs sm:text-sm font-semibold rounded-lg bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 transition-all flex items-center justify-center gap-2 shadow-xs hover:border-slate-300 cursor-pointer"
            >
              <Sliders className="w-4 h-4 text-slate-500" />
              <span>Run a Strategy Simulation</span>
            </a>
          </MagneticButton>
        </motion.div>

        {/* ========================================================================= */}
        {/* CONTINUOUS LIVING PRODUCT ENGINE VISUALIZATION                            */}
        {/* ========================================================================= */}
        <motion.div
          style={{
            scale: visualScale,
            y: visualY,
            x: useTransform(mouseX, (x) => x * 0.7),
          }}
          className="pt-10 max-w-4xl mx-auto text-left transition-transform duration-100 ease-out origin-top"
        >
          <div className="relative min-h-[360px] p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden">
            {/* Top Engine Status Bar */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 relative z-20">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold font-mono uppercase tracking-wider text-slate-800">
                  Autonomous Decision Engine • Active
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Live Transaction Processing Stream
              </span>
            </div>

            {/* Living Orbital Flow Canvas */}
            <div className="relative h-[220px] flex items-center justify-center">
              {/* Central Recovery Engine Hub */}
              <motion.div
                animate={{
                  scale: [1, 1.02, 1],
                  boxShadow: [
                    '0 4px 12px rgba(15, 23, 42, 0.05)',
                    '0 8px 24px rgba(15, 23, 42, 0.1)',
                    '0 4px 12px rgba(15, 23, 42, 0.05)',
                  ],
                }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                className="relative z-10 w-44 sm:w-52 p-4 rounded-2xl bg-white border-2 border-slate-900 text-center shadow-md space-y-1.5"
              >
                <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center mx-auto shadow-xs">
                  <Zap className="w-4 h-4 fill-white" />
                </div>
                <h4 className="text-xs font-bold font-mono uppercase tracking-tight text-slate-900">
                  Recovery Engine
                </h4>
                <p className="text-[10px] font-mono text-slate-500">
                  Diagnose → Predict → Route
                </p>
              </motion.div>

              {/* Ingestion & Dispatch Paths (Subtle SVG guides) */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-slate-200">
                {/* Top Entry Path */}
                <path d="M 400 20 L 400 80" strokeDasharray="3 3" strokeWidth="1.5" />
                {/* Bottom Left Outcome Path */}
                <path d="M 330 140 Q 280 180 200 190" strokeDasharray="3 3" strokeWidth="1.5" fill="none" />
                {/* Bottom Right Outcome Path */}
                <path d="M 470 140 Q 520 180 600 190" strokeDasharray="3 3" strokeWidth="1.5" fill="none" />
              </svg>

              {/* Animated Flowing Transaction Card */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentTxn.id}
                  initial={{
                    x: currentTxn.startX,
                    y: currentTxn.startY,
                    opacity: 0,
                    scale: 0.85,
                  }}
                  animate={{
                    x: [currentTxn.startX, 0, currentTxn.endX],
                    y: [currentTxn.startY, -40, currentTxn.endY],
                    opacity: [0, 1, 1],
                    scale: [0.85, 1, 0.95],
                  }}
                  transition={{
                    duration: 2.8,
                    times: [0, 0.45, 1],
                    ease: 'easeInOut',
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.8,
                    transition: { duration: 0.3 },
                  }}
                  className="absolute z-20 w-56 sm:w-64 p-3 rounded-xl bg-white border border-slate-300 shadow-md pointer-events-none"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-1.5 text-xs font-mono">
                    <span className="font-bold text-slate-900">{currentTxn.amount}</span>
                    <span className="text-[10px] text-slate-500">{currentTxn.method}</span>
                  </div>

                  <div className="text-[11px] font-mono text-rose-700 flex items-center gap-1 mb-1.5">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span className="truncate">{currentTxn.failure}</span>
                  </div>

                  <div className={`p-1.5 rounded text-[10px] font-mono font-semibold border flex items-center gap-1 ${currentTxn.outcomeColor}`}>
                    <currentTxn.icon className="w-3 h-3 shrink-0" />
                    <span className="truncate">{currentTxn.outcome}</span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Bottom Processing Tickers */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono pt-3 border-t border-slate-100 relative z-20">
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                <span className="text-slate-400 block text-[10px]">Processing Speed</span>
                <strong className="text-slate-900">12ms average</strong>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                <span className="text-slate-400 block text-[10px]">Recovery Lift</span>
                <strong className="text-emerald-700">+16.6 pp vs naive</strong>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                <span className="text-slate-400 block text-[10px]">Merchant Protection</span>
                <strong className="text-slate-900">100% Policy Bound</strong>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
