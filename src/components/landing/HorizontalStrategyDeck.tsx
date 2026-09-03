'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  AlertCircle,
  Clock,
  MessageSquare,
  UserCheck,
  Zap,
  Ban,
  ArrowRight,
  TrendingUp,
  ShieldAlert,
} from 'lucide-react';
import CursorCard from './CursorCard';

interface StrategyCardItem {
  id: string;
  badge: string;
  badgeColor: string;
  icon: any;
  title: string;
  subtitle: string;
  prob: string;
  expectedRecovery: string;
  cost: string;
  risk: string;
  riskColor: string;
  description: string;
  isWinning?: boolean;
}

const STRATEGY_CARDS: StrategyCardItem[] = [
  {
    id: 'trigger',
    badge: 'The Trigger',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    icon: AlertCircle,
    title: 'Failed Payment',
    subtitle: '₹24,000 Corporate Subscription',
    prob: '0%',
    expectedRecovery: '₹0 (At Risk)',
    cost: '₹0.00',
    risk: 'Direct Churn Risk',
    riskColor: 'text-rose-600',
    description: 'UPI Auto-pay mandate returned switch timeout on morning billing cycle.',
  },
  {
    id: 'immediate',
    badge: 'Outcome 01',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: Zap,
    title: 'Immediate Retry',
    subtitle: 'Default Gateway Behavior',
    prob: '14.8%',
    expectedRecovery: '₹3,552',
    cost: '₹0.25',
    risk: 'High (Switch Downtime)',
    riskColor: 'text-rose-600',
    description: 'Retries instantly while bank CBS switch is down, generating repeated declines.',
  },
  {
    id: 'delayed',
    badge: 'Outcome 02',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: Clock,
    title: 'Delayed Retry',
    subtitle: '6-Hour Scheduled Debit',
    prob: '23.7%',
    expectedRecovery: '₹5,688',
    cost: '₹0.25',
    risk: 'Low Technical Risk',
    riskColor: 'text-emerald-600',
    description: 'Waits for banking switch load to subside before silently executing debit.',
  },
  {
    id: 'reminder',
    badge: 'Outcome 03',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: MessageSquare,
    title: 'Customer Reminder',
    subtitle: 'WhatsApp 1-Tap Deep Link',
    prob: '19.4%',
    expectedRecovery: '₹4,656',
    cost: '₹1.50',
    risk: 'Moderate Fatigue Risk',
    riskColor: 'text-amber-600',
    description: 'Nudges the customer directly with a frictionless instant UPI payment prompt.',
  },
  {
    id: 'review',
    badge: 'Outcome 04',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: UserCheck,
    title: 'Human Review Gate',
    subtitle: 'Ops Team Escalation',
    prob: '42.0%',
    expectedRecovery: '₹10,080',
    cost: '₹15.00 (Ops Time)',
    risk: 'Slow Velocity',
    riskColor: 'text-slate-600',
    description: 'Account manager personal contact for high-ticket enterprise contracts.',
  },
  {
    id: 'ai-optimized',
    badge: 'RecoverIQ Optimal',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
    icon: TrendingUp,
    title: 'AI Optimized Strategy',
    subtitle: 'Dynamic Multi-Rail Routing',
    prob: '91.0%',
    expectedRecovery: '₹21,840',
    cost: '₹0.25',
    risk: 'Zero Friction',
    riskColor: 'text-emerald-600 font-bold',
    description: 'Identifies switch pattern & schedules silent debit at customer peak balance hour.',
    isWinning: true,
  },
  {
    id: 'suppress',
    badge: 'Outcome 06',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: Ban,
    title: 'Do Nothing (Suppress)',
    subtitle: 'When Risk > Expected Yield',
    prob: '0.0%',
    expectedRecovery: '₹0 Net Loss Avoided',
    cost: '₹0.00',
    risk: 'Protected Margins',
    riskColor: 'text-blue-600',
    description: 'Blocks low-EV retries to save dispute fees (₹1,500) and preserve VIP loyalty.',
  },
];

export default function HorizontalStrategyDeck() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Transform vertical scroll into horizontal translation across the cards deck
  // 7 cards total: slide from 0% to approximately -68%
  const x = useTransform(scrollYProgress, [0.05, 0.95], ['2%', '-65%']);

  return (
    <div id="strategies-deck" ref={containerRef} className="relative bg-white border-t border-slate-200">
      {/* 250vh scroll distance to provide comfortable scroll speed */}
      <div className="h-[250vh] relative">
        {/* Pinned Viewport Container */}
        <div className="sticky top-0 h-screen w-full flex flex-col justify-center overflow-hidden py-8">
          <div className="max-w-7xl mx-auto w-full px-6 lg:px-12 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div className="space-y-1">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
                  Strategy Comparison
                </span>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                  One failed payment. Multiple possible outcomes.
                </h2>
                <p className="text-xs sm:text-sm text-slate-600">
                  Scroll vertically to explore how different recovery paths impact yield, cost, and friction.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <span>Scroll down to navigate rail</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Horizontal Cards Rail */}
            <div className="relative pt-2 pb-4 overflow-hidden">
              <motion.div
                style={{ x }}
                className="flex gap-5 w-max will-change-transform"
              >
                {STRATEGY_CARDS.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.id}
                      className={`w-[320px] sm:w-[350px] shrink-0 p-6 rounded-2xl border transition-all duration-200 ${
                        card.isWinning
                          ? 'bg-slate-900 text-white border-slate-800 shadow-lg'
                          : 'bg-slate-50/80 text-slate-900 border-slate-200 hover:border-slate-300 shadow-xs'
                      }`}
                    >
                      {/* Badge & Icon */}
                      <div className="flex items-center justify-between border-b pb-3 mb-4 border-slate-200/50">
                        <span
                          className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border ${card.badgeColor}`}
                        >
                          {card.badge}
                        </span>
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            card.isWinning ? 'bg-slate-800 text-emerald-400' : 'bg-white text-slate-700 shadow-xs'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                      </div>

                      {/* Title & Subtitle */}
                      <div className="space-y-1">
                        <h3 className={`text-base font-bold ${card.isWinning ? 'text-white' : 'text-slate-900'}`}>
                          {card.title}
                        </h3>
                        <p className={`text-xs font-mono ${card.isWinning ? 'text-slate-400' : 'text-slate-500'}`}>
                          {card.subtitle}
                        </p>
                      </div>

                      {/* Description */}
                      <p className={`text-xs mt-3 leading-relaxed ${card.isWinning ? 'text-slate-300' : 'text-slate-600'}`}>
                        {card.description}
                      </p>

                      {/* 4 Financial Metrics Grid */}
                      <div className={`mt-5 pt-4 border-t space-y-2 text-xs font-mono ${card.isWinning ? 'border-slate-800' : 'border-slate-200'}`}>
                        <div className="flex justify-between">
                          <span className={card.isWinning ? 'text-slate-400' : 'text-slate-500'}>
                            Recovery Probability:
                          </span>
                          <strong className={card.isWinning ? 'text-emerald-400' : 'text-slate-900'}>
                            {card.prob}
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className={card.isWinning ? 'text-slate-400' : 'text-slate-500'}>
                            Expected Recovery (EV):
                          </span>
                          <strong className={card.isWinning ? 'text-emerald-400' : 'text-slate-900'}>
                            {card.expectedRecovery}
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className={card.isWinning ? 'text-slate-400' : 'text-slate-500'}>
                            Intervention Cost:
                          </span>
                          <strong className={card.isWinning ? 'text-slate-200' : 'text-slate-900'}>
                            {card.cost}
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className={card.isWinning ? 'text-slate-400' : 'text-slate-500'}>
                            Risk Rating:
                          </span>
                          <span className={card.riskColor}>
                            {card.risk}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
