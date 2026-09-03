'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Zap } from 'lucide-react';

export default function StickyNavbar() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'h-14 bg-white/85 backdrop-blur-md border-b border-slate-200/80 shadow-xs'
          : 'h-16 bg-transparent border-b border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto h-full px-6 lg:px-12 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-md bg-slate-900 flex items-center justify-center text-white font-bold shadow-xs transition-transform duration-200 group-hover:scale-105">
              <Zap className="w-4 h-4 fill-white" />
            </div>
            <span className="font-semibold text-slate-900 tracking-tight text-sm">
              RecoverIQ
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs text-slate-600 font-medium">
            <a href="#how-it-works" className="hover:text-slate-900 transition-colors py-1">
              Flow
            </a>
            <a href="#strategies-deck" className="hover:text-slate-900 transition-colors py-1">
              Outcomes
            </a>
            <a href="#simulator" className="hover:text-slate-900 transition-colors py-1">
              Simulator
            </a>
            <a href="#suppression" className="hover:text-slate-900 transition-colors py-1">
              Suppression
            </a>
            <a href="#experiments" className="hover:text-slate-900 transition-colors py-1">
              Experiments
            </a>
            <a href="#trust" className="hover:text-slate-900 transition-colors py-1">
              Governance
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors px-2 py-1"
          >
            Sign in
          </Link>
          <Link
            href="/dashboard"
            className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-xs hover:shadow-sm hover:-translate-y-0.5"
          >
            Launch platform
          </Link>
        </div>
      </div>
    </header>
  );
}
