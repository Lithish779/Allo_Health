// src/app/page.tsx

import { prisma } from '@/lib/prisma';
import { releaseExpiredReservations } from '@/lib/expiry';
import { ProductGrid } from '@/components/ProductGrid';
import type { ProductWithStock } from '@/types';

async function getProducts(): Promise<ProductWithStock[]> {
  // Lazy expiry cleanup
  await releaseExpiredReservations().catch((err) =>
    console.error('[HomePage] expiry cleanup failed:', err)
  );

  const products = await prisma.product.findMany({
    orderBy: { name: 'asc' },
    include: {
      stock: {
        include: { warehouse: true },
        orderBy: { warehouse: { name: 'asc' } },
      },
    },
  });

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    price: p.price,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    stock: p.stock.map((s) => ({
      warehouseId: s.warehouseId,
      warehouseName: s.warehouse.name,
      warehouseLocation: s.warehouse.location,
      totalUnits: s.totalUnits,
      reservedUnits: s.reservedUnits,
      availableUnits: Math.max(0, s.totalUnits - s.reservedUnits),
    })),
  }));
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
