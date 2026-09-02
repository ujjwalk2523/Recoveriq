'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  Sliders,
  CheckCircle2,
  Lock,
  Building,
  TrendingUp,
  AlertTriangle,
  Clock,
  MessageSquare,
  ChevronRight,
  Sparkles,
  Ban,
  Activity,
  Check,
  Layers,
} from 'lucide-react';

import CursorLight from '@/components/landing/CursorLight';
import ScrollProgressBar from '@/components/landing/ScrollProgressBar';
import StickyNavbar from '@/components/landing/StickyNavbar';
import HeroScrollStory from '@/components/landing/HeroScrollStory';
import StickyRevenueFlow from '@/components/landing/StickyRevenueFlow';
import MovableStrategyDeck from '@/components/landing/MovableStrategyDeck';
import RecoverySimulatorScroll from '@/components/landing/RecoverySimulatorScroll';
import PaymentLifecycleStory from '@/components/landing/PaymentLifecycleStory';
import IntelligentSuppressionStory from '@/components/landing/IntelligentSuppressionStory';
import CardStackExploder from '@/components/landing/CardStackExploder';
import StatisticalSplitLab from '@/components/landing/StatisticalSplitLab';
import CursorCard from '@/components/landing/CursorCard';
import MagneticButton from '@/components/landing/MagneticButton';
import CountUpNumber from '@/components/landing/CountUpNumber';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-slate-200 selection:text-slate-900 font-sans antialiased relative">
      {/* Interactive Global Pointer Light */}
      <CursorLight />

      {/* 2px Sticky Scroll Progress Indicator */}
      <ScrollProgressBar />

      {/* Dynamic Scroll-Activated Navbar */}
      <StickyNavbar />

      {/* Main Continuous Canvas Container */}
      <main className="relative z-10 flex-1">
        {/* ========================================================================= */}
        {/* 1. HERO — LIVING PRODUCT ENGINE & CURSOR PARALLAX                         */}
        {/* ========================================================================= */}
        <HeroScrollStory />

        {/* ========================================================================= */}
        {/* 2. THE PROBLEM — THE FUNDAMENTAL FLAW OF LEGACY RECOVERY                  */}
        {/* ========================================================================= */}
        <section className="py-24 bg-white border-t border-slate-200">
          <div className="max-w-5xl mx-auto px-6 space-y-12">
            <div className="max-w-2xl space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
                The Fundamental Flaw of Legacy Recovery
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                Not every failed payment should be retried.
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Standard retry logic fires automated attempts on rigid fixed intervals. On Indian payment rails, blind retries waste merchant margins, trigger bank penalties, and damage customer relationships.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <CursorCard className="p-6 bg-white space-y-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-mono text-xs font-bold">
                  01
                </div>
                <h3 className="text-sm font-semibold text-slate-900">Repeated switch rejections</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Retrying immediately during a bank CBS switch outage causes instant declines and incurs non-refundable gateway processing fees.
                </p>
              </CursorCard>

              <CursorCard className="p-6 bg-white space-y-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-mono text-xs font-bold">
                  02
                </div>
                <h3 className="text-sm font-semibold text-slate-900">Checkout abandonment</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  When a customer drops at the 3DS OTP step, silently retrying the card in the background will fail 100% of the time without direct re-engagement.
                </p>
              </CursorCard>

              <CursorCard className="p-6 bg-white space-y-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-mono text-xs font-bold">
                  03
                </div>
                <h3 className="text-sm font-semibold text-slate-900">Negative unit economics</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Spending ₹3.50 on SMS and ₹1.50 on WhatsApp to chase low-ticket ₹99 transactions with low recovery odds destroys merchant contribution margins.
                </p>
              </CursorCard>

              <CursorCard className="p-6 bg-white space-y-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-mono text-xs font-bold">
                  04
                </div>
                <h3 className="text-sm font-semibold text-slate-900">Customer friction & churn</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Spamming high-LTV VIP accounts with repeated automated decline notifications causes high customer fatigue and subscription cancellations.
                </p>
              </CursorCard>
            </div>

            {/* Shift Banner */}
            <CursorCard className="p-6 bg-slate-50 border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-mono uppercase font-bold text-slate-400">The RecoverIQ Shift</span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  RecoverIQ decides what is worth recovering.
                </h3>
              </div>
              <a
                href="#how-it-works"
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-all shrink-0 flex items-center gap-1.5 shadow-xs hover:shadow-md cursor-pointer"
              >
                <span>Inspect the recovery pipeline</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </CursorCard>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. STICKY 6-STAGE REVENUE FLOW (PINNED STORYTELLING)                      */}
        {/* ========================================================================= */}
        <StickyRevenueFlow />

        {/* ========================================================================= */}
        {/* 4. MOVABLE STRATEGY DECK (PHYSICAL SORTING & WINNER REVEAL)               */}
        {/* ========================================================================= */}
        <MovableStrategyDeck />

        {/* ========================================================================= */}
        {/* 5. RECOVERY SIMULATOR (PROGRESSIVE COHORT PARTITIONING)                   */}
        {/* ========================================================================= */}
        <RecoverySimulatorScroll />

        {/* ========================================================================= */}
        {/* 6. PAYMENT LIFECYCLE STORY (BRANCHING & SELF-DRAWING CHART)               */}
        {/* ========================================================================= */}
        <PaymentLifecycleStory />

        {/* ========================================================================= */}
        {/* 7. WHY NOT RECOVER? (INTELLIGENT SUPPRESSION REASONING)                   */}
        {/* ========================================================================= */}
        <IntelligentSuppressionStory />

        {/* ========================================================================= */}
        {/* 8. CARD STACK EXPLODER (INTERACTIVE DECISION TRACE)                       */}
        {/* ========================================================================= */}
        <CardStackExploder />

        {/* ========================================================================= */}
        {/* 9. EXPERIMENT LAB (STATISTICAL SPLIT TESTING WITH SHINING BORDER)         */}
        {/* ========================================================================= */}
        <StatisticalSplitLab />

        {/* ========================================================================= */}
        {/* 10. ENTERPRISE GOVERNANCE & CONTROL                                       */}
        {/* ========================================================================= */}
        <section id="trust" className="py-24 bg-slate-50 border-t border-slate-200">
          <div className="max-w-5xl mx-auto px-6 space-y-12">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
                Enterprise Governance
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                Autonomous where it is safe.<br />
                <span className="text-slate-500 font-medium">Human-controlled where it matters.</span>
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Designed with strict guardrails, review gates, and immutable audit logs so finance teams retain complete oversight.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <CursorCard className="p-6 bg-white space-y-2">
                <h4 className="text-sm font-bold text-slate-900">Policy Guardrails</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Configure auto-approval monetary ceilings (e.g. up to ₹15,000) and confidence thresholds.
                </p>
              </CursorCard>

              <CursorCard className="p-6 bg-white space-y-2">
                <h4 className="text-sm font-bold text-slate-900">Human Review Gates</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  High-value enterprise transactions and VIP subscribers are automatically held for team review.
                </p>
              </CursorCard>

              <CursorCard className="p-6 bg-white space-y-2">
                <h4 className="text-sm font-bold text-slate-900">Immutable Audit Trail</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Every decision, retry dispatch, and policy override is hashed with SHA-256 signatures.
                </p>
              </CursorCard>

              <CursorCard className="p-6 bg-white space-y-2">
                <h4 className="text-sm font-bold text-slate-900">Webhook Idempotency</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Guarantees zero duplicate debit attempts even under network retries or gateway race conditions.
                </p>
              </CursorCard>

              <CursorCard className="p-6 bg-white space-y-2">
                <h4 className="text-sm font-bold text-slate-900">Demo & Sandbox Mode</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Test failure simulations safely with built-in mock telemetry before connecting live Razorpay API keys.
                </p>
              </CursorCard>

              <CursorCard className="p-6 bg-white space-y-2">
                <h4 className="text-sm font-bold text-slate-900">Bounded Actions</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Strict retry caps per customer per week prevent notification fatigue and customer churn.
                </p>
              </CursorCard>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 11. FINAL CTA (OBSIDIAN DARK THEME WITH AMBIENT MOTION & MAGNETIC CTAS)   */}
        {/* ========================================================================= */}
        <section className="py-32 bg-[#0a0e17] text-white relative overflow-hidden border-t border-slate-800">
          {/* Subtle Ambient Floating Glow Drift */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.08),_transparent_70%)] pointer-events-none animate-pulse-glow"
            aria-hidden="true"
          />

          <div className="max-w-4xl mx-auto px-6 text-center space-y-8 relative z-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-800/90 border border-slate-700/80 text-xs text-slate-300 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Production-Ready Decision Intelligence</span>
            </div>

            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Stop retrying blindly.<br />
              <span className="text-slate-400">Start recovering intelligently.</span>
            </h2>

            <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
              Maximize your Expected Recovery Value, eliminate unnecessary decline fees, and protect your merchant margins with RecoverIQ.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <MagneticButton maxDistance={8}>
                <Link
                  href="/dashboard"
                  className="w-full sm:w-auto px-7 py-3.5 text-xs sm:text-sm font-semibold rounded-lg bg-white text-slate-950 hover:bg-slate-100 transition-all shadow-md hover:shadow-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Launch RecoverIQ Platform</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </MagneticButton>

              <MagneticButton maxDistance={8}>
                <Link
                  href="/simulator"
                  className="w-full sm:w-auto px-7 py-3.5 text-xs sm:text-sm font-semibold rounded-lg bg-slate-800/80 text-white hover:bg-slate-700 border border-slate-700 hover:border-slate-600 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sliders className="w-4 h-4 text-slate-400" />
                  <span>Run Strategy Simulator</span>
                </Link>
              </MagneticButton>
            </div>
          </div>
        </section>
      </main>

      {/* Rich SaaS Footer */}
      <footer className="border-t border-slate-800 bg-[#080c14] py-14 px-6 lg:px-12 text-xs text-slate-400 relative z-10">
        <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-8">
          <div className="col-span-2 space-y-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center text-slate-950 font-bold shadow-xs">
                <Zap className="w-4 h-4 fill-slate-950 text-slate-950" />
              </div>
              <span className="font-semibold text-white tracking-tight text-sm">RecoverIQ</span>
            </div>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              Revenue recovery and decision intelligence platform for Indian merchants. Built for UPI, Cards, and Mandates.
            </p>
            <p className="text-[11px] text-slate-500 font-mono pt-1">
              © 2026 RecoverIQ Technologies Inc. All rights reserved.
            </p>
          </div>

          <div className="space-y-2.5">
            <h5 className="font-semibold text-white uppercase tracking-wider text-[10px]">Product</h5>
            <ul className="space-y-2">
              <li><Link href="/dashboard" className="hover:text-white transition-colors flex items-center gap-1 group"><span>Dashboard</span><ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-slate-300" /></Link></li>
              <li><Link href="/transactions" className="hover:text-white transition-colors flex items-center gap-1 group"><span>Transactions</span><ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-slate-300" /></Link></li>
              <li><Link href="/recovery-opportunities" className="hover:text-white transition-colors flex items-center gap-1 group"><span>Opportunities</span><ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-slate-300" /></Link></li>
              <li><Link href="/simulator" className="hover:text-white transition-colors flex items-center gap-1 group"><span>Simulator</span><ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-slate-300" /></Link></li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h5 className="font-semibold text-white uppercase tracking-wider text-[10px]">Intelligence</h5>
            <ul className="space-y-2">
              <li><Link href="/ai-decisions" className="hover:text-white transition-colors flex items-center gap-1 group"><span>Decision Trace</span><ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-slate-300" /></Link></li>
              <li><Link href="/experiments" className="hover:text-white transition-colors flex items-center gap-1 group"><span>Experiment Lab</span><ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-slate-300" /></Link></li>
              <li><Link href="/analytics" className="hover:text-white transition-colors flex items-center gap-1 group"><span>Analytics</span><ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-slate-300" /></Link></li>
              <li><Link href="/audit-log" className="hover:text-white transition-colors flex items-center gap-1 group"><span>Audit Log</span><ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-slate-300" /></Link></li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h5 className="font-semibold text-white uppercase tracking-wider text-[10px]">Governance</h5>
            <ul className="space-y-2">
              <li><Link href="/settings" className="hover:text-white transition-colors flex items-center gap-1 group"><span>Policy Settings</span><ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-slate-300" /></Link></li>
              <li><Link href="/onboarding" className="hover:text-white transition-colors flex items-center gap-1 group"><span>Merchant Setup</span><ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-slate-300" /></Link></li>
              <li><span className="text-slate-500 cursor-not-allowed">Privacy Policy</span></li>
              <li><span className="text-slate-500 cursor-not-allowed">Terms of Service</span></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
