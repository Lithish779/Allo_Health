// src/app/api/reservations/[id]/release/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const result = await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({ where: { id } });

    if (!reservation) return { type: 'not_found' as const };

    if (reservation.status !== 'PENDING') {
      return { type: 'not_releasable' as const, status: reservation.status };
    }

    await tx.stock.update({
      where: {
        productId_warehouseId: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
        },
      },
      data: { reservedUnits: { decrement: reservation.quantity } },
    });

    const released = await tx.reservation.update({
      where: { id },
      data: { status: 'RELEASED' },
      include: { product: true, warehouse: true },
    });

    return { type: 'success' as const, reservation: released };
  });

  if (result.type === 'not_found') {
    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
  }

  if (result.type === 'not_releasable') {
    return NextResponse.json(
      { error: `Cannot release a reservation with status "${result.status}"` },
      { status: 409 }
    );
  }

  return NextResponse.json(shapeReservation(result.reservation));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shapeReservation(r: any) {
  return {
    id: r.id,
    productId: r.productId,
    warehouseId: r.warehouseId,
    quantity: r.quantity,
    status: r.status,
    expiresAt: r.expiresAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    product: r.product ? { id: r.product.id, name: r.product.name, price: r.product.price } : undefined,
    warehouse: r.warehouse ? { id: r.warehouse.id, name: r.warehouse.name, location: r.warehouse.location } : undefined,
  };
}
