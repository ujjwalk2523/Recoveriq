'use client';

import React, { useState } from 'react';
import { DecisionTraceStep } from '@/lib/engine/types';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
} from 'lucide-react';

interface DecisionTraceViewProps {
  trace: DecisionTraceStep[];
  compact?: boolean;
}

export function DecisionTraceView({ trace, compact = false }: DecisionTraceViewProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const toggleExpand = (stepNum: number) => {
    setExpandedStep(expandedStep === stepNum ? null : stepNum);
  };

  return (
    <div className="space-y-2">
      <div className="relative pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
        {trace.map((step) => {
          const isExpanded = expandedStep === step.step;

          let statusIcon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
          let circleBg = 'bg-white border-slate-300 text-slate-700';

          if (step.status === 'IN_PROGRESS' || step.status === 'AWAITING_APPROVAL') {
            statusIcon = <Clock className="w-3.5 h-3.5 text-amber-600" />;
            circleBg = 'bg-amber-50 border-amber-300 text-amber-800';
          } else if (step.status === 'SKIPPED') {
            statusIcon = <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />;
            circleBg = 'bg-slate-100 border-slate-300 text-slate-500';
          } else if (step.status === 'FAILED') {
            statusIcon = <AlertCircle className="w-3.5 h-3.5 text-rose-600" />;
            circleBg = 'bg-rose-50 border-rose-300 text-rose-800';
          }

          return (
            <div key={step.step} className="relative pb-3 last:pb-0">
              {/* Step indicator node */}
              <div
                className={`absolute -left-6 top-1 w-4 h-4 rounded-full border flex items-center justify-center text-[9px] font-mono font-medium ${circleBg}`}
              >
                {step.step}
              </div>

              {/* Step Card */}
              <div
                onClick={() => toggleExpand(step.step)}
                className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                  isExpanded
                    ? 'bg-white border-slate-300 shadow-xs'
                    : 'bg-white border-slate-200/90 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-900">
                      {step.step}. {step.name}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {new Date(step.timestamp).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px]">
                    {statusIcon}
                    <span
                      className={`font-medium ${
                        step.status === 'COMPLETED'
                          ? 'text-emerald-700'
                          : step.status === 'AWAITING_APPROVAL'
                          ? 'text-amber-700'
                          : 'text-slate-500'
                      }`}
                    >
                      {step.status === 'AWAITING_APPROVAL' ? 'Review required' : step.status.toLowerCase()}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400 ml-1" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{step.summary}</p>

                {/* Expanded Details JSON */}
                {isExpanded && step.details && Object.keys(step.details).length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100">
                    <pre className="text-[11px] font-mono p-2.5 rounded bg-slate-50 border border-slate-200 text-slate-800 overflow-x-auto">
                      {JSON.stringify(step.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
