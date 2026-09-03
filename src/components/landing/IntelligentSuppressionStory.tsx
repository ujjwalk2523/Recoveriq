'use client';

import React, { useRef, useState, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  Ban,
  UserCheck,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  Lock,
} from 'lucide-react';
import CountUpNumber from './CountUpNumber';
import CursorCard from './CursorCard';

export default function IntelligentSuppressionStory() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: '-60px' });
  const [reasonStage, setReasonStage] = useState<number>(0);

  useEffect(() => {
    if (!isInView) return;

    // Sequential reason reveals
    const t1 = setTimeout(() => setReasonStage(1), 500); // 6 previous failures
    const t2 = setTimeout(() => setReasonStage(2), 1100); // Customer friction risk
    const t3 = setTimeout(() => setReasonStage(3), 1700); // Low expected value
    const t4 = setTimeout(() => setReasonStage(4), 2300); // Policy threshold exceeded
    const t5 = setTimeout(() => setReasonStage(5), 2900); // DO NOT RETRY STAMP & Counter

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [isInView]);

  return (
    <section id="suppression" ref={containerRef} className="py-24 bg-white border-t border-slate-200">
      <div className="max-w-5xl mx-auto px-6 space-y-12">
        {/* Header */}
        <div className="max-w-2xl space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
            Intelligent Suppression
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Sometimes the smartest recovery is no recovery.
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            RecoverIQ explicitly suppresses retries when recovery is mathematically unlikely, costs more than the expected yield, or risks causing chargeback penalties and customer churn.
          </p>
        </div>

        {/* Real Transaction Suppression Case Study */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Transaction Card with Stamped Decision */}
          <CursorCard className="p-6 bg-white space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-mono font-bold text-slate-900">#TXN_98412</span>
              {reasonStage >= 5 ? (
                <motion.span
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 font-extrabold tracking-wider"
                >
                  DO NOT RETRY
                </motion.span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-semibold animate-pulse">
                  Reasoning...
                </span>
              )}
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block">Failed Payment Amount</span>
              <div className="text-2xl font-bold font-mono text-slate-900">₹18,500</div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Recovery probability:</span>
                <span className="font-mono font-bold text-rose-700">11%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Customer fatigue score:</span>
                <span className="font-mono font-bold text-rose-700">88 / 100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Dispute chargeback risk:</span>
                <span className="font-mono font-bold text-rose-700">High (74/100)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Expected Value (EV):</span>
                <span className="font-mono font-bold text-slate-900">-₹340</span>
              </div>
            </div>

            {/* Final Stamped Badge */}
            {reasonStage >= 5 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-center font-mono text-xs font-bold text-rose-800"
              >
                AI DECISION: ACTION SUPPRESSED
              </motion.div>
            )}
          </CursorCard>

          {/* Right: Step-by-Step AI Reasoning Trail */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
                  Why was recovery suppressed?
                </h3>
                <span className="text-[11px] font-mono text-slate-400">
                  {reasonStage < 4 ? `Evaluating factor ${reasonStage}/4` : 'Evaluation Complete'}
                </span>
              </div>

              <div className="space-y-2.5">
                {/* Reason 1 */}
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{
                    opacity: reasonStage >= 1 ? 1 : 0.2,
                    x: reasonStage >= 1 ? 0 : -10,
                  }}
                  transition={{ duration: 0.3 }}
                  className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 transition-colors ${
                    reasonStage >= 1
                      ? 'bg-slate-50 border-slate-300 text-slate-700'
                      : 'bg-slate-50/40 border-slate-200 text-slate-400'
                  }`}
                >
                  <Ban className={`w-4 h-4 shrink-0 mt-0.5 ${reasonStage >= 1 ? 'text-rose-600' : 'text-slate-400'}`} />
                  <div>
                    <strong className={reasonStage >= 1 ? 'text-slate-900' : 'text-slate-500'}>
                      1. 6 previous failures:{' '}
                    </strong>
                    Repeated hard declines indicate an inactive instrument. Additional retries trigger bank chargeback fees (₹1,500/dispute).
                  </div>
                </motion.div>

                {/* Reason 2 */}
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{
                    opacity: reasonStage >= 2 ? 1 : 0.2,
                    x: reasonStage >= 2 ? 0 : -10,
                  }}
                  transition={{ duration: 0.3 }}
                  className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 transition-colors ${
                    reasonStage >= 2
                      ? 'bg-slate-50 border-slate-300 text-slate-700'
                      : 'bg-slate-50/40 border-slate-200 text-slate-400'
                  }`}
                >
                  <UserCheck className={`w-4 h-4 shrink-0 mt-0.5 ${reasonStage >= 2 ? 'text-amber-600' : 'text-slate-400'}`} />
                  <div>
                    <strong className={reasonStage >= 2 ? 'text-slate-900' : 'text-slate-500'}>
                      2. Customer friction risk:{' '}
                    </strong>
                    Customer fatigue score (88/100) exceeded safety policy. Sending notifications risks losing a ₹2.4L LTV subscriber relationship.
                  </div>
                </motion.div>

                {/* Reason 3 */}
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{
                    opacity: reasonStage >= 3 ? 1 : 0.2,
                    x: reasonStage >= 3 ? 0 : -10,
                  }}
                  transition={{ duration: 0.3 }}
                  className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 transition-colors ${
                    reasonStage >= 3
                      ? 'bg-slate-50 border-slate-300 text-slate-700'
                      : 'bg-slate-50/40 border-slate-200 text-slate-400'
                  }`}
                >
                  <TrendingDown className={`w-4 h-4 shrink-0 mt-0.5 ${reasonStage >= 3 ? 'text-slate-600' : 'text-slate-400'}`} />
                  <div>
                    <strong className={reasonStage >= 3 ? 'text-slate-900' : 'text-slate-500'}>
                      3. Negative expected value (EV = -₹340):{' '}
                    </strong>
                    Low 11% probability × ₹18,500 is outweighed by ₹1,500 dispute risk and channel cost.
                  </div>
                </motion.div>

                {/* Reason 4 */}
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{
                    opacity: reasonStage >= 4 ? 1 : 0.2,
                    x: reasonStage >= 4 ? 0 : -10,
                  }}
                  transition={{ duration: 0.3 }}
                  className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 transition-colors ${
                    reasonStage >= 4
                      ? 'bg-slate-50 border-slate-300 text-slate-700'
                      : 'bg-slate-50/40 border-slate-200 text-slate-400'
                  }`}
                >
                  <ShieldCheck className={`w-4 h-4 shrink-0 mt-0.5 ${reasonStage >= 4 ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <div>
                    <strong className={reasonStage >= 4 ? 'text-slate-900' : 'text-slate-500'}>
                      4. Policy threshold exceeded:{' '}
                    </strong>
                    Action automatically routed to merchant review queue rather than automated retry.
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Autonomous Protection Metric Count-up */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: reasonStage >= 5 ? 1 : 0.4 }}
              className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between"
            >
              <span className="text-xs text-slate-600 font-medium">
                Autonomous Protection Metric:
              </span>
              <span className="text-xs font-mono font-bold text-slate-900">
                {reasonStage >= 5 ? (
                  <>
                    <CountUpNumber value={183} suffix=" attempts" /> & ₹2.7L dispute risk avoided
                  </>
                ) : (
                  'Calculating avoided risk...'
                )}
              </span>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
