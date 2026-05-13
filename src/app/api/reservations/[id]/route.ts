// src/app/api/reservations/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: params.id },
    include: { product: true, warehouse: true },
  });

  if (!reservation) {
    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: reservation.id,
    productId: reservation.productId,
    warehouseId: reservation.warehouseId,
    quantity: reservation.quantity,
    status: reservation.status,
    expiresAt: reservation.expiresAt.toISOString(),
    createdAt: reservation.createdAt.toISOString(),
    updatedAt: reservation.updatedAt.toISOString(),
    product: {
      id: reservation.product.id,
      name: reservation.product.name,
      description: reservation.product.description,
      price: reservation.product.price,
      imageUrl: reservation.product.imageUrl,
    },
    warehouse: {
      id: reservation.warehouse.id,
      name: reservation.warehouse.name,
      location: reservation.warehouse.location,
    },
  });
}
