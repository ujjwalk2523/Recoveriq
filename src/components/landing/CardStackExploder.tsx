'use client';

import React, { useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  BrainCircuit,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Zap,
  ChevronDown,
  Layers,
  Sparkles,
} from 'lucide-react';

export default function CardStackExploder() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredStackIdx, setHoveredStackIdx] = useState<number | null>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  // Smooth card separation and fanning out as user scrolls through the section
  const card1Y = useTransform(scrollYProgress, [0.2, 0.55], [0, -110]);
  const card1Rotate = useTransform(scrollYProgress, [0.2, 0.55], [-1.5, 0]);
  const card1Scale = useTransform(scrollYProgress, [0.2, 0.55], [0.96, 1]);

  const card2Y = useTransform(scrollYProgress, [0.2, 0.55], [0, 0]);
  const card2Rotate = useTransform(scrollYProgress, [0.2, 0.55], [1.5, 0]);
  const card2Scale = useTransform(scrollYProgress, [0.2, 0.55], [0.98, 1]);

  const card3Y = useTransform(scrollYProgress, [0.2, 0.55], [0, 110]);
  const card3Rotate = useTransform(scrollYProgress, [0.2, 0.55], [-0.5, 0]);
  const card3Scale = useTransform(scrollYProgress, [0.2, 0.55], [1, 1]);

  // Helper for dynamic hover focus vs blur
  const getCardHoverStyle = (idx: number) => {
    if (hoveredStackIdx === null) {
      return {
        filter: 'blur(0px)',
        opacity: 1,
        transform: 'scale(1)',
        zIndex: idx === 3 ? 30 : idx === 2 ? 20 : 10,
      };
    }
    if (hoveredStackIdx === idx) {
      return {
        filter: 'blur(0px)',
        opacity: 1,
        transform: 'scale(1.025)',
        zIndex: 50,
      };
    }
    return {
      filter: 'blur(5px)',
      opacity: 0.35,
      transform: 'scale(0.97)',
      zIndex: 10,
    };
  };

  return (
    <section id="decision-intelligence" ref={containerRef} className="py-32 bg-slate-50 border-t border-slate-200 overflow-hidden select-none">
      <div className="max-w-5xl mx-auto px-6 space-y-16">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-mono text-slate-700 shadow-xs">
            <Layers className="w-3.5 h-3.5 text-slate-700" />
            <span>Interactive Decision Trace</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Every decision explained in plain financial terms.
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Hover over any layer to focus on its reasoning while other factors blur into context.
          </p>
        </div>

        {/* Stacked Cards Area with Interactive Focus & Blur */}
        <div className="relative min-h-[460px] flex items-center justify-center">
          {/* Card 1: Top Layer (Recovery Opportunity) */}
          <motion.div
            style={{
              y: card1Y,
              rotate: card1Rotate,
              scale: card1Scale,
              ...getCardHoverStyle(1),
            }}
            onMouseEnter={() => setHoveredStackIdx(1)}
            onMouseLeave={() => setHoveredStackIdx(null)}
            className={`absolute w-full max-w-2xl p-6 rounded-2xl border transition-all duration-300 cursor-pointer ${
              hoveredStackIdx === 1
                ? 'bg-white border-emerald-400 shadow-2xl ring-2 ring-emerald-500/20'
                : 'bg-white border-slate-200/90 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-mono font-bold uppercase text-slate-800">
                  Layer 01 • Recovery Opportunity
                </span>
              </div>
              <span className="text-xs font-mono text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                91% Probability
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px]">Customer Name</span>
                <strong className="text-slate-900 text-sm">Rahul Sharma</strong>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px]">Failed Amount</span>
                <strong className="text-slate-900 text-sm">₹18,500 INR</strong>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px]">Customer Segment</span>
                <strong className="text-slate-900 text-sm">VIP Enterprise</strong>
              </div>
            </div>
          </motion.div>

          {/* Card 2: Middle Layer (Previous Payment History) */}
          <motion.div
            style={{
              y: card2Y,
              rotate: card2Rotate,
              scale: card2Scale,
              ...getCardHoverStyle(2),
            }}
            onMouseEnter={() => setHoveredStackIdx(2)}
            onMouseLeave={() => setHoveredStackIdx(null)}
            className={`absolute w-full max-w-2xl p-6 rounded-2xl border transition-all duration-300 cursor-pointer ${
              hoveredStackIdx === 2
                ? 'bg-white border-blue-400 shadow-2xl ring-2 ring-blue-500/20'
                : 'bg-white border-slate-200/90 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-mono font-bold uppercase text-slate-800">
                  Layer 02 • Behavioral History & Bank Switch
                </span>
              </div>
              <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                Fatigue Score: 18/100 (Safe)
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>7 previous successful monthly debits on this HDFC VPA</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                <span>NPCI CBS switch timeout at 08:30 AM (Temporary bank lag)</span>
              </div>
            </div>
          </motion.div>

          {/* Card 3: Bottom Layer (Recommended Action) */}
          <motion.div
            style={{
              y: card3Y,
              rotate: card3Rotate,
              scale: card3Scale,
              ...getCardHoverStyle(3),
            }}
            onMouseEnter={() => setHoveredStackIdx(3)}
            onMouseLeave={() => setHoveredStackIdx(null)}
            className={`absolute w-full max-w-2xl p-6 rounded-2xl border transition-all duration-300 cursor-pointer ${
              hoveredStackIdx === 3
                ? 'bg-slate-900 text-white border-emerald-500 shadow-2xl ring-2 ring-emerald-500/30'
                : 'bg-slate-900 text-white border-slate-800 shadow-md'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono font-bold uppercase text-emerald-400">
                  Layer 03 • Recommended Action
                </span>
              </div>
              <span className="text-xs font-mono text-emerald-300 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                Auto-Approved (Policy &lt; ₹30k)
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
              <div>
                <span className="text-slate-400 block text-[10px]">Optimal Execution Channel</span>
                <strong className="text-white text-base">Scheduled 10:00 AM Silent Debit</strong>
              </div>
              <div className="text-right sm:text-right">
                <span className="text-slate-400 block text-[10px]">Net Expected Value (EV)</span>
                <strong className="text-emerald-400 text-base">₹16,835 INR</strong>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
