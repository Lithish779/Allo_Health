// src/app/page.tsx

import { ProductGrid } from '@/components/ProductGrid';
import type { ProductWithStock } from '@/types';

async function getProducts(): Promise<ProductWithStock[]> {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  const res = await fetch(`${baseUrl}/api/products`, {
    cache: 'no-store',
  });

  if (!res.ok) throw new Error('Failed to fetch products');
  return res.json();
}

export default async function HomePage() {
  const products = await getProducts();

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <span className="font-display text-xl tracking-tight text-stone-900">allo</span>
            <span className="ml-2 text-xs font-medium text-stone-400 uppercase tracking-widest">Inventory</span>
          </div>
          <span className="text-xs text-stone-400 font-medium">
            {products.length} product{products.length !== 1 ? 's' : ''}
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-14 pb-10">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 mb-3">
            Multi-warehouse stock
          </p>
          <h1 className="font-display text-4xl md:text-5xl leading-tight text-stone-900">
            Reserve before<br />
            <em>someone else does.</em>
          </h1>
          <p className="mt-4 text-stone-500 text-base leading-relaxed max-w-md">
            Units are held for 10 minutes during checkout.
            Pay in time and the order is yours — let the timer run out and the hold releases.
          </p>
        </div>
      </section>

      {/* Products */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <ProductGrid products={products} />
      </section>
    </main>
  );
}
