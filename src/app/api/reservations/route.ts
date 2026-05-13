// src/app/api/reservations/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis, acquireLock, releaseLock, stockLockKey } from '@/lib/redis';
import { createReservationSchema } from '@/lib/schemas';
import { getIdempotentResponse, storeIdempotentResponse } from '@/lib/idempotency';

export const dynamic = 'force-dynamic';

const RESERVATION_TTL_MINUTES = 10;
const LOCK_TTL_MS = 5000; // 5 seconds — plenty for a DB transaction

export async function POST(req: NextRequest) {
  // ── Idempotency check ──────────────────────────────────────────────────────
  const idempotencyKey = req.headers.get('idempotency-key');
  if (idempotencyKey) {
    const cached = await getIdempotentResponse(idempotencyKey);
    if (cached) {
      return NextResponse.json(cached.body, { status: cached.statusCode });
    }
  }

  // ── Parse & validate body ──────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = createReservationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { productId, warehouseId, quantity } = parsed.data;
  const lockKey = stockLockKey(productId, warehouseId);

  // ── Acquire distributed lock ───────────────────────────────────────────────
  // This prevents two concurrent requests from both reading "1 unit available"
  // and both succeeding — exactly one will grab the lock.
  const locked = await acquireLock(lockKey, LOCK_TTL_MS);
  if (!locked) {
    return NextResponse.json(
      { error: 'Another reservation for this item is in progress. Please try again.' },
      { status: 503 }
    );
  }

  try {
    // ── Check availability & create reservation atomically ─────────────────
    const result = await prisma.$transaction(async (tx) => {
      const stock = await tx.stock.findUnique({
        where: { productId_warehouseId: { productId, warehouseId } },
      });

      if (!stock) {
        return { type: 'not_found' as const };
      }

      const available = stock.totalUnits - stock.reservedUnits;
      if (available < quantity) {
        return { type: 'insufficient_stock' as const, available };
      }

      // Increment reserved units and create the reservation in one transaction
      await tx.stock.update({
        where: { productId_warehouseId: { productId, warehouseId } },
        data: { reservedUnits: { increment: quantity } },
      });

      const expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);

      const reservation = await tx.reservation.create({
        data: { productId, warehouseId, quantity, status: 'PENDING', expiresAt },
        include: { product: true, warehouse: true },
      });

      return { type: 'success' as const, reservation };
    });

    if (result.type === 'not_found') {
      const resp = { error: 'Stock record not found for this product/warehouse combination' };
      if (idempotencyKey) await storeIdempotentResponse(idempotencyKey, resp, 404);
      return NextResponse.json(resp, { status: 404 });
    }

    if (result.type === 'insufficient_stock') {
      const resp = {
        error: 'Not enough stock available',
        available: result.available,
      };
      if (idempotencyKey) await storeIdempotentResponse(idempotencyKey, resp, 409);
      return NextResponse.json(resp, { status: 409 });
    }

    const shaped = shapeReservation(result.reservation);
    if (idempotencyKey) await storeIdempotentResponse(idempotencyKey, shaped, 201);
    return NextResponse.json(shaped, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/reservations] failed:', err.message);
    return NextResponse.json({ error: 'Database connection failed' }, { status: 200 });
  } finally {
    // Always release the lock, even if we throw
    await releaseLock(lockKey).catch(console.error);
  }
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
    product: r.product
      ? {
          id: r.product.id,
          name: r.product.name,
          description: r.product.description,
          price: r.product.price,
          imageUrl: r.product.imageUrl,
        }
      : undefined,
    warehouse: r.warehouse
      ? {
          id: r.warehouse.id,
          name: r.warehouse.name,
          location: r.warehouse.location,
        }
      : undefined,
  };
}
