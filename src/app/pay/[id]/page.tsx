'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  ShieldCheck,
  Zap,
  ArrowRight,
  Smartphone,
  CreditCard,
  Building,
  Clock,
  Sparkles,
  Lock,
} from 'lucide-react';

export default function CustomerPayPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';

  const [isLoading, setIsLoading] = useState(true);
  const [transaction, setTransaction] = useState<any>(null);
  const [selectedMethod, setSelectedMethod] = useState<'UPI' | 'CARD'>('UPI');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/pay/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.transaction) {
          setTransaction(data.transaction);
          if (data.transaction.status === 'RECOVERED') {
            setIsSuccess(true);
          }
        }
      })
      .catch((err) => console.warn('Failed to load payment details:', err))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleCompletePayment = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/pay/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: selectedMethod }),
      });

      const data = await res.json();
      if (data.success) {
        setIsSuccess(true);
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      }
    } catch (e) {
      alert('Payment simulation failed, please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Securing order recovery session...</p>
        </div>
      </div>
    );
  }

  const amount = transaction?.amount || 2500;
  const customerName = transaction?.customerName || 'Valued Customer';
  const merchantName = transaction?.merchantName || 'SaaSify Technologies India Pvt Ltd';
  const orderId = transaction?.orderId || id;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Merchant Header */}
        <div className="bg-slate-900 text-white p-5 px-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight">{merchantName}</span>
              <span className="p-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">Order: {orderId}</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Amount Due</span>
            <div className="text-xl font-bold font-mono text-emerald-400">
              ₹{amount.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Status Alert Banner */}
        {!isSuccess ? (
          <div className="bg-amber-50 border-b border-amber-200/80 p-3 px-6 flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-900">Your previous payment timed out</p>
              <p className="text-[11px] text-amber-700 leading-tight mt-0.5">
                We have saved your order for 15 minutes. Complete it below with 1-tap UPI to avoid losing your reservation.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50 border-b border-emerald-200 p-4 px-6 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-emerald-900">Payment Successfully Recovered!</h4>
              <p className="text-xs text-emerald-700 mt-0.5">
                ₹{amount.toLocaleString('en-IN')} received. Order #{orderId} confirmed!
              </p>
            </div>
          </div>
        )}

        {/* Main Body */}
        <div className="p-6 space-y-5">
          {!isSuccess ? (
            <>
              <div>
                <p className="text-xs text-slate-500">Billing to:</p>
                <p className="text-sm font-bold text-slate-800">{customerName}</p>
                {transaction?.customerPhone && (
                  <p className="text-xs text-slate-500 font-mono">{transaction.customerPhone}</p>
                )}
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
                  Select Recovery Rail
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('UPI')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-2 ${
                      selectedMethod === 'UPI'
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-600'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Smartphone className={`w-4 h-4 ${selectedMethod === 'UPI' ? 'text-emerald-700' : 'text-slate-500'}`} />
                      <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                        Fastest
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">UPI 1-Tap</p>
                      <p className="text-[10px] text-slate-500">Google Pay, PhonePe, Paytm</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMethod('CARD')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-2 ${
                      selectedMethod === 'CARD'
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-600'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <CreditCard className={`w-4 h-4 ${selectedMethod === 'CARD' ? 'text-emerald-700' : 'text-slate-500'}`} />
                    <div>
                      <p className="text-xs font-bold text-slate-900">Alternate Card</p>
                      <p className="text-[10px] text-slate-500">Visa, RuPay, Mastercard</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Pay Button */}
              <button
                type="button"
                onClick={handleCompletePayment}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Authorizing ₹{amount.toLocaleString('en-IN')}...</span>
                  </>
                ) : (
                  <>
                    <span>Pay ₹{amount.toLocaleString('en-IN')} Now</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
                <Lock className="w-3 h-3" />
                <span>256-bit encrypted • Powered by RecoverIQ Autonomous Rails</span>
              </div>
            </>
          ) : (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Transaction Settled!</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                  Thank you, {customerName}. Your payment was recovered and credited to {merchantName}.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 font-mono text-left space-y-1">
                <div className="flex justify-between">
                  <span>Settlement Ref:</span>
                  <span className="font-semibold text-slate-800">{id.slice(0, 16)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment Channel:</span>
                  <span className="font-semibold text-emerald-700">RecoverIQ 1-Tap {selectedMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span>Amount Credited:</span>
                  <span className="font-semibold text-slate-900">₹{amount.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                You can safely close this browser window.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
