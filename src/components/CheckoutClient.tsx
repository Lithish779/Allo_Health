'use client';

// src/components/CheckoutClient.tsx

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Reservation } from '@/types';

interface Props {
  initialReservation: Reservation;
}

type UIState =
  | { phase: 'checkout' }
  | { phase: 'confirmed' }
  | { phase: 'cancelled' }
  | { phase: 'expired' }
  | { phase: 'error'; message: string };

const EMOJI_MAP: Record<string, string> = {
  'Ergonomic Mesh Chair': '🪑',
  'Mechanical Keyboard TKL': '⌨️',
  '4K Monitor 27"': '🖥️',
  'Standing Desk Frame': '🗂️',
  'Wireless Trackball Mouse': '🖱️',
  'Laptop Arm Mount': '🦾',
};

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(price);
}

function useCountdown(expiresAt: string) {
  const getRemaining = useCallback(() => {
    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  }, [expiresAt]);

  const [remaining, setRemaining] = useState(getRemaining);

  useEffect(() => {
    if (remaining <= 0) return;
    const interval = setInterval(() => {
      const r = getRemaining();
      setRemaining(r);
      if (r <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [getRemaining, remaining]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isUrgent = remaining <= 60 && remaining > 0;
  const isExpired = remaining === 0;

  return { remaining, minutes, seconds, isUrgent, isExpired };
}

export function CheckoutClient({ initialReservation }: Props) {
  const router = useRouter();
  const [uiState, setUiState] = useState<UIState>(
    initialReservation.status === 'CONFIRMED'
      ? { phase: 'confirmed' }
      : initialReservation.status === 'RELEASED'
      ? { phase: 'cancelled' }
      : { phase: 'checkout' }
  );
  const [loading, setLoading] = useState<'confirm' | 'cancel' | null>(null);
  const reservation = initialReservation;
  const { minutes, seconds, isUrgent, isExpired } = useCountdown(reservation.expiresAt);

  // Auto-transition to expired state when timer hits zero
  useEffect(() => {
    if (isExpired && uiState.phase === 'checkout') {
      setUiState({ phase: 'expired' });
    }
  }, [isExpired, uiState.phase]);

  async function handleConfirm() {
    setLoading('confirm');
    try {
      const res = await fetch(`/api/reservations/${reservation.id}/confirm`, {
        method: 'POST',
      });
      const data = await res.json();

      if (res.status === 410) {
        setUiState({ phase: 'expired' });
        return;
      }
      if (!res.ok) {
        setUiState({ phase: 'error', message: data.error ?? 'Confirmation failed. Please try again.' });
        return;
      }
      setUiState({ phase: 'confirmed' });
    } catch {
      setUiState({ phase: 'error', message: 'Network error. Please check your connection.' });
    } finally {
      setLoading(null);
    }
  }

  async function handleCancel() {
    setLoading('cancel');
    try {
      const res = await fetch(`/api/reservations/${reservation.id}/release`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        setUiState({ phase: 'error', message: data.error ?? 'Could not cancel reservation.' });
        return;
      }
      setUiState({ phase: 'cancelled' });
    } catch {
      setUiState({ phase: 'error', message: 'Network error. Please check your connection.' });
    } finally {
      setLoading(null);
    }
  }

  const emoji = reservation.product ? (EMOJI_MAP[reservation.product.name] ?? '📦') : '📦';
  const productName = reservation.product?.name ?? 'Product';
  const warehouseName = reservation.warehouse?.name ?? 'Warehouse';
  const price = reservation.product?.price ?? 0;
  const total = price * reservation.quantity;

  return (
    <main className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors text-sm"
          >
            <span>←</span>
            <span>Back to products</span>
          </button>
          <span className="font-display text-xl tracking-tight text-stone-900">allo</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-12">

        {/* ── CHECKOUT PHASE ─────────────────────────────────────────────── */}
        {uiState.phase === 'checkout' && (
          <div className="fade-up">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 mb-2">
              Reservation active
            </p>
            <h1 className="font-display text-3xl md:text-4xl text-stone-900 mb-8">
              Complete your order
            </h1>

            {/* Order summary card */}
            <div className="bg-white rounded-2xl border border-stone-200 p-6 mb-5">
              <div className="flex items-center gap-4 mb-5 pb-5 border-b border-stone-100">
                <div className="w-16 h-16 rounded-xl bg-stone-50 flex items-center justify-center text-3xl flex-shrink-0">
                  {emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-stone-900 text-base leading-snug">{productName}</h2>
                  <p className="text-sm text-stone-400 mt-0.5">
                    Ships from {warehouseName}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-semibold text-stone-900">{formatPrice(price)}</div>
                  <div className="text-xs text-stone-400">per unit</div>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-stone-500">
                  <span>Quantity</span>
                  <span className="text-stone-900 font-medium">{reservation.quantity}</span>
                </div>
                <div className="flex justify-between text-stone-500">
                  <span>Reservation ID</span>
                  <span className="text-stone-400 font-mono text-xs">{reservation.id.slice(0, 12)}…</span>
                </div>
                <div className="pt-3 mt-3 border-t border-stone-100 flex justify-between">
                  <span className="font-semibold text-stone-900">Total</span>
                  <span className="font-display text-xl text-stone-900">{formatPrice(total)}</span>
                </div>
              </div>
            </div>

            {/* Countdown card */}
            <div
              className={`rounded-2xl border p-5 mb-6 transition-colors duration-500 ${
                isUrgent
                  ? 'bg-red-50 border-red-200'
                  : 'bg-amber-50 border-amber-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${isUrgent ? 'text-red-500' : 'text-amber-600'}`}>
                    {isUrgent ? 'Expiring soon!' : 'Hold expires in'}
                  </p>
                  <p className="text-xs text-stone-500">
                    Complete payment before the timer runs out
                  </p>
                </div>
                <div
                  className={`font-display text-3xl tabular-nums font-bold tracking-tight ${
                    isUrgent ? 'text-red-600 urgency-pulse' : 'text-amber-700'
                  }`}
                >
                  {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4 h-1.5 rounded-full bg-stone-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${isUrgent ? 'bg-red-400' : 'bg-amber-400'}`}
                  style={{
                    width: `${(((minutes * 60 + seconds) / 600) * 100).toFixed(1)}%`,
                    transition: 'width 1s linear',
                  }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleCancel}
                disabled={loading !== null}
                className="flex-1 py-4 rounded-xl border border-stone-200 text-sm font-medium text-stone-600
                  hover:bg-stone-100 disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                {loading === 'cancel' ? 'Cancelling…' : 'Cancel reservation'}
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading !== null}
                className="flex-1 py-4 rounded-xl bg-stone-900 text-white text-sm font-semibold
                  hover:bg-amber-600 disabled:opacity-50 transition-all duration-150 active:scale-[0.98]"
              >
                {loading === 'confirm' ? 'Processing…' : 'Confirm purchase →'}
              </button>
            </div>
          </div>
        )}

        {/* ── CONFIRMED ──────────────────────────────────────────────────── */}
        {uiState.phase === 'confirmed' && (
          <OutcomeCard
            emoji="✅"
            title="Order confirmed"
            subtitle="Your purchase is complete."
            description={`${reservation.quantity}× ${productName} has been confirmed and will ship from ${warehouseName}.`}
            detail={`Order ref: ${reservation.id.slice(0, 12)}…`}
            accentClass="bg-emerald-50 border-emerald-200 text-emerald-700"
            onHome={() => router.push('/')}
          />
        )}

        {/* ── CANCELLED ──────────────────────────────────────────────────── */}
        {uiState.phase === 'cancelled' && (
          <OutcomeCard
            emoji="↩️"
            title="Reservation cancelled"
            subtitle="Your hold has been released."
            description="The units are back in stock for other shoppers. You can create a new reservation at any time."
            accentClass="bg-stone-100 border-stone-200 text-stone-600"
            onHome={() => router.push('/')}
          />
        )}

        {/* ── EXPIRED ────────────────────────────────────────────────────── */}
        {uiState.phase === 'expired' && (
          <OutcomeCard
            emoji="⏰"
            title="Reservation expired"
            subtitle="The 10-minute hold has ended."
            description="Your reservation timed out before payment was completed. The stock has been released. Head back to try again."
            accentClass="bg-orange-50 border-orange-200 text-orange-700"
            onHome={() => router.push('/')}
          />
        )}

        {/* ── ERROR ──────────────────────────────────────────────────────── */}
        {uiState.phase === 'error' && (
          <OutcomeCard
            emoji="⚠️"
            title="Something went wrong"
            subtitle={uiState.message}
            description="Please return to the product page and try again. If the problem persists, contact support."
            accentClass="bg-red-50 border-red-200 text-red-700"
            onHome={() => router.push('/')}
          />
        )}
      </div>
    </main>
  );
}

function OutcomeCard({
  emoji,
  title,
  subtitle,
  description,
  detail,
  accentClass,
  onHome,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  description: string;
  detail?: string;
  accentClass: string;
  onHome: () => void;
}) {
  return (
    <div className="fade-up text-center max-w-md mx-auto">
      <div className="text-6xl mb-6">{emoji}</div>
      <h1 className="font-display text-3xl text-stone-900 mb-2">{title}</h1>
      <p className="text-stone-500 mb-6 leading-relaxed">{description}</p>

      {detail && (
        <p className="text-xs font-mono text-stone-400 mb-6">{detail}</p>
      )}

      <div className={`inline-block px-4 py-2 rounded-full border text-sm font-medium mb-8 ${accentClass}`}>
        {subtitle}
      </div>

      <div className="block">
        <button
          onClick={onHome}
          className="w-full py-4 rounded-xl bg-stone-900 text-white text-sm font-semibold
            hover:bg-amber-600 transition-all duration-150 active:scale-[0.98]"
        >
          ← Back to products
        </button>
      </div>
    </div>
  );
}
