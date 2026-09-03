'use client';

import React, { useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { TrendingUp, Sparkles, CheckCircle2 } from 'lucide-react';
import CountUpNumber from './CountUpNumber';

interface DataPoint {
  hour: string;
  baseline: number;
  ai: number;
  recoveredDiff: number;
}

const CHART_DATA: DataPoint[] = [
  { hour: '0h', baseline: 8.2, ai: 8.2, recoveredDiff: 0 },
  { hour: '4h', baseline: 11.0, ai: 16.5, recoveredDiff: 12000 },
  { hour: '8h', baseline: 12.8, ai: 23.4, recoveredDiff: 28000 },
  { hour: '12h', baseline: 13.9, ai: 28.1, recoveredDiff: 39000 },
  { hour: '18h', baseline: 14.4, ai: 30.5, recoveredDiff: 46000 },
  { hour: '24h', baseline: 14.8, ai: 31.4, recoveredDiff: 49000 },
];

export default function ProgressiveChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: '-60px' });
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // SVG Chart Dimensions
  const width = 680;
  const height = 240;
  const paddingX = 45;
  const paddingY = 30;

  const minVal = 0;
  const maxVal = 35;

  const getX = (idx: number) =>
    paddingX + (idx / (CHART_DATA.length - 1)) * (width - paddingX * 2);

  const getY = (val: number) =>
    height - paddingY - ((val - minVal) / (maxVal - minVal)) * (height - paddingY * 2);

  // Build SVG path strings
  const baselinePath = CHART_DATA.reduce(
    (acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(pt.baseline)}`,
    ''
  );

  const aiPath = CHART_DATA.reduce(
    (acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(pt.ai)}`,
    ''
  );

  const aiAreaPath = `${aiPath} L ${getX(CHART_DATA.length - 1)} ${height - paddingY} L ${getX(0)} ${height - paddingY} Z`;

  const activePoint = hoveredIdx !== null ? CHART_DATA[hoveredIdx] : CHART_DATA[CHART_DATA.length - 1];

  return (
    <div ref={containerRef} className="p-6 md:p-8 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-6">
      {/* Header & Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold">
            Cohort Velocity Curve (24h Window)
          </span>
          <h3 className="text-base font-bold text-slate-900 mt-0.5">
            Progressive Recovery Trajectory
          </h3>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-slate-400 rounded-full" />
            <span className="text-slate-500">Baseline (14.8%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-1 bg-emerald-600 rounded-full" />
            <span className="text-emerald-700 font-bold">RecoverIQ (31.4%)</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none"
          style={{ minWidth: '460px' }}
        >
          {/* Subtle Grid Lines */}
          {[10, 20, 30].map((val) => {
            const y = getY(val);
            return (
              <g key={val}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingX - 10}
                  y={y + 3}
                  fontSize="10"
                  fill="#94a3b8"
                  textAnchor="end"
                  fontFamily="monospace"
                >
                  {val}%
                </text>
              </g>
            );
          })}

          {/* Area Fill for AI Line */}
          {isInView && (
            <motion.path
              d={aiAreaPath}
              fill="url(#aiGradient)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.12 }}
              transition={{ duration: 1.2, delay: 0.6 }}
            />
          )}

          <defs>
            <linearGradient id="aiGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Line 1: Baseline (Dashed Slate) */}
          {isInView && (
            <motion.path
              d={baselinePath}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2"
              strokeDasharray="4 4"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.0, ease: 'easeInOut' }}
            />
          )}

          {/* Line 2: AI Optimized (Solid Emerald) */}
          {isInView && (
            <motion.path
              d={aiPath}
              fill="none"
              stroke="#059669"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.4, ease: 'easeOut', delay: 0.4 }}
            />
          )}

          {/* Interactive Data Points & Vertical Hover Line */}
          {CHART_DATA.map((pt, idx) => {
            const cx = getX(idx);
            const cyAi = getY(pt.ai);
            const cyBase = getY(pt.baseline);
            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={pt.hour}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Invisible hover capture rect */}
                <rect
                  x={cx - 25}
                  y={0}
                  width="50"
                  height={height}
                  fill="transparent"
                />

                {/* X Axis Labels */}
                <text
                  x={cx}
                  y={height - 8}
                  fontSize="11"
                  fill="#64748b"
                  textAnchor="middle"
                  fontFamily="monospace"
                  fontWeight={isHovered ? 'bold' : 'normal'}
                >
                  {pt.hour}
                </text>

                {/* Hover line */}
                {isHovered && (
                  <line
                    x1={cx}
                    y1={paddingY}
                    x2={cx}
                    y2={height - paddingY}
                    stroke="#cbd5e1"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                )}

                {/* Point for Baseline */}
                {isInView && (
                  <circle
                    cx={cx}
                    cy={cyBase}
                    r={isHovered ? 4.5 : 3}
                    fill="#94a3b8"
                    className="transition-all duration-200"
                  />
                )}

                {/* Point for AI */}
                {isInView && (
                  <circle
                    cx={cx}
                    cy={cyAi}
                    r={isHovered ? 6 : 4}
                    fill="#059669"
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="transition-all duration-200 shadow-xs"
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Delta Callout Summary Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 10 }}
        transition={{ duration: 0.5, delay: 1.2 }}
        className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono"
      >
        <div className="flex items-center gap-2 text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            At {activePoint.hour}: RecoverIQ achieves <strong>{activePoint.ai}%</strong> recovery vs{' '}
            <strong>{activePoint.baseline}%</strong> baseline
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="px-2.5 py-1 rounded bg-emerald-600 text-white font-bold">
            +16.6 pp lift
          </span>
          <span className="text-emerald-900 font-bold">
            +₹49,000 expected recovery
          </span>
        </div>
      </motion.div>
    </div>
  );
}
