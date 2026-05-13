'use client';

// src/components/ProductGrid.tsx

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProductWithStock, StockEntry } from '@/types';

interface Props {
  products: ProductWithStock[];
}

const EMOJI_MAP: Record<string, string> = {
  'Ergonomic Mesh Chair': '🪑',
  'Mechanical Keyboard TKL': '⌨️',
  '4K Monitor 27"': '🖥️',
  'Standing Desk Frame': '🗂️',
  'Wireless Trackball Mouse': '🖱️',
  'Laptop Arm Mount': '🦾',
};

function stockBadge(available: number) {
  if (available === 0) return { label: 'Out of stock', cls: 'bg-stone-100 text-stone-400' };
  if (available <= 3) return { label: `${available} left`, cls: 'bg-red-50 text-red-600 font-semibold' };
  if (available <= 10) return { label: `${available} available`, cls: 'bg-amber-50 text-amber-700' };
  return { label: `${available} available`, cls: 'bg-emerald-50 text-emerald-700' };
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price);
}

export function ProductGrid({ products }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<{ product: ProductWithStock } | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [reserving, setReserving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openModal(product: ProductWithStock) {
    const firstAvailable = product.stock.find((s) => s.availableUnits > 0);
    setModal({ product });
    setSelectedWarehouse(firstAvailable?.warehouseId ?? product.stock[0]?.warehouseId ?? '');
    setQuantity(1);
    setError(null);
  }

  function closeModal() {
    setModal(null);
    setError(null);
  }

  async function handleReserve() {
    if (!modal || !selectedWarehouse) return;
    setReserving(true);
    setError(null);

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: modal.product.id,
          warehouseId: selectedWarehouse,
          quantity,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setError(`Not enough stock. Only ${data.available ?? 0} unit(s) available.`);
        return;
      }

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      // Navigate to checkout page
      router.push(`/checkout/${data.id}`);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setReserving(false);
    }
  }

  const selectedStock = modal?.product.stock.find((s) => s.warehouseId === selectedWarehouse);
  const maxQty = selectedStock?.availableUnits ?? 0;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {products.map((product, i) => {
          const totalAvailable = product.stock.reduce((sum, s) => sum + s.availableUnits, 0);
          const emoji = EMOJI_MAP[product.name] ?? '📦';
          const delayClass = `fade-up fade-up-delay-${Math.min(i + 1, 6)}`;

          return (
            <div
              key={product.id}
              className={`${delayClass} group bg-white rounded-2xl border border-stone-200 overflow-hidden hover:border-stone-300 hover:shadow-md transition-all duration-200`}
            >
              {/* Product visual area */}
              <div className="bg-gradient-to-br from-stone-50 to-stone-100 h-40 flex items-center justify-center text-6xl select-none">
                {emoji}
              </div>

              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h2 className="font-semibold text-stone-900 text-[15px] leading-snug">{product.name}</h2>
                </div>

                {product.description && (
                  <p className="text-stone-400 text-xs leading-relaxed mt-1 mb-3 line-clamp-2">
                    {product.description}
                  </p>
                )}

                {/* Per-warehouse stock */}
                <div className="space-y-1.5 mb-4">
                  {product.stock.map((s) => {
                    const badge = stockBadge(s.availableUnits);
                    return (
                      <div key={s.warehouseId} className="flex items-center justify-between text-xs">
                        <span className="text-stone-500">{s.warehouseName}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-display text-lg text-stone-900">{formatPrice(product.price)}</span>
                  <button
                    onClick={() => openModal(product)}
                    disabled={totalAvailable === 0}
                    className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150
                      bg-stone-900 text-white hover:bg-amber-600 disabled:bg-stone-200 disabled:text-stone-400
                      disabled:cursor-not-allowed active:scale-95"
                  >
                    {totalAvailable === 0 ? 'Unavailable' : 'Reserve'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reserve modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/40 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 sm:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-5">
              <span className="text-3xl">{EMOJI_MAP[modal.product.name] ?? '📦'}</span>
              <div>
                <h3 className="font-semibold text-stone-900">{modal.product.name}</h3>
                <p className="text-sm text-stone-400">{formatPrice(modal.product.price)}</p>
              </div>
            </div>

            {/* Warehouse selector */}
            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
                Ship from
              </label>
              <div className="space-y-2">
                {modal.product.stock.map((s) => (
                  <WarehouseOption
                    key={s.warehouseId}
                    stock={s}
                    selected={selectedWarehouse === s.warehouseId}
                    onSelect={() => {
                      setSelectedWarehouse(s.warehouseId);
                      setQuantity(1);
                      setError(null);
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Quantity */}
            {maxQty > 0 && (
              <div className="mb-5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
                  Quantity
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-9 h-9 rounded-lg border border-stone-200 flex items-center justify-center text-stone-500 hover:bg-stone-50 active:scale-95 transition-all"
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-semibold text-stone-900">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                    className="w-9 h-9 rounded-lg border border-stone-200 flex items-center justify-center text-stone-500 hover:bg-stone-50 active:scale-95 transition-all"
                  >
                    +
                  </button>
                  <span className="text-xs text-stone-400 ml-1">of {maxQty} available</span>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Info strip */}
            <p className="text-xs text-stone-400 mb-4 leading-relaxed">
              Reserving holds this item for <strong className="text-stone-600">10 minutes</strong>. 
              If payment isn't completed, the hold is released automatically.
            </p>

            <div className="flex gap-3">
              <button
                onClick={closeModal}
                className="flex-1 py-3 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReserve}
                disabled={reserving || maxQty === 0}
                className="flex-1 py-3 rounded-xl bg-stone-900 text-white text-sm font-semibold
                  hover:bg-amber-600 disabled:bg-stone-200 disabled:text-stone-400
                  transition-all duration-150 active:scale-[0.98]"
              >
                {reserving ? 'Reserving…' : maxQty === 0 ? 'Out of stock' : 'Confirm reserve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function WarehouseOption({
  stock,
  selected,
  onSelect,
}: {
  stock: StockEntry;
  selected: boolean;
  onSelect: () => void;
}) {
  const badge = stockBadge(stock.availableUnits);
  return (
    <button
      onClick={onSelect}
      disabled={stock.availableUnits === 0}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all text-sm
        ${selected ? 'border-stone-900 bg-stone-50' : 'border-stone-200 hover:border-stone-300'}
        ${stock.availableUnits === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div>
        <span className="font-medium text-stone-900">{stock.warehouseName}</span>
        <span className="ml-2 text-xs text-stone-400">{stock.warehouseLocation}</span>
      </div>
      <span className={`px-2 py-0.5 rounded-full text-[11px] ${badge.cls}`}>{badge.label}</span>
    </button>
  );
}
