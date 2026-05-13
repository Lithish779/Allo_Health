// src/app/api/products/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { releaseExpiredReservations } from '@/lib/expiry';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Lazy expiry cleanup on each product list fetch
  await releaseExpiredReservations().catch((err) =>
    console.error('[GET /api/products] expiry cleanup failed:', err)
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

  const shaped = products.map((p) => ({
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

  return NextResponse.json(shaped);
}
