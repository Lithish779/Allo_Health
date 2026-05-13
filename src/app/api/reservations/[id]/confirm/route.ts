// src/app/api/reservations/[id]/confirm/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getIdempotentResponse, storeIdempotentResponse } from '@/lib/idempotency';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  // ── Idempotency ─────────────────────────────────────────────────────────────
  const idempotencyKey = req.headers.get('idempotency-key');
  if (idempotencyKey) {
    const cached = await getIdempotentResponse(idempotencyKey);
    if (cached) {
      return NextResponse.json(cached.body, { status: cached.statusCode });
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id },
      include: { product: true, warehouse: true },
    });

    if (!reservation) return { type: 'not_found' as const };

    if (reservation.status === 'CONFIRMED') {
      return { type: 'already_confirmed' as const, reservation };
    }

    if (reservation.status === 'RELEASED') {
      return { type: 'already_released' as const };
    }

    // PENDING — check expiry
    if (reservation.expiresAt < new Date()) {
      // Release the held stock since it expired
      await tx.stock.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: { reservedUnits: { decrement: reservation.quantity } },
      });

      await tx.reservation.update({
        where: { id },
        data: { status: 'RELEASED' },
      });

      return { type: 'expired' as const };
    }

    // Confirm: decrement total stock and clear the reserved hold
    await tx.stock.update({
      where: {
        productId_warehouseId: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
        },
      },
      data: {
        totalUnits: { decrement: reservation.quantity },
        reservedUnits: { decrement: reservation.quantity },
      },
    });

    const confirmed = await tx.reservation.update({
      where: { id },
      data: { status: 'CONFIRMED' },
      include: { product: true, warehouse: true },
    });

    return { type: 'success' as const, reservation: confirmed };
  });

  if (result.type === 'not_found') {
    const resp = { error: 'Reservation not found' };
    if (idempotencyKey) await storeIdempotentResponse(idempotencyKey, resp, 404);
    return NextResponse.json(resp, { status: 404 });
  }

  if (result.type === 'expired') {
    const resp = { error: 'Reservation has expired. The hold has been released.' };
    if (idempotencyKey) await storeIdempotentResponse(idempotencyKey, resp, 410);
    return NextResponse.json(resp, { status: 410 });
  }

  if (result.type === 'already_released') {
    const resp = { error: 'Reservation was already released' };
    if (idempotencyKey) await storeIdempotentResponse(idempotencyKey, resp, 409);
    return NextResponse.json(resp, { status: 409 });
  }

  const shaped = shapeReservation(result.reservation);
  if (idempotencyKey) await storeIdempotentResponse(idempotencyKey, shaped, 200);
  return NextResponse.json(shaped, { status: 200 });
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
