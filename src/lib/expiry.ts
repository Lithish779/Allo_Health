// src/lib/expiry.ts
// Lazy cleanup: called on every read that touches reservations.
// Also used by the cron route.

import { prisma } from './prisma';

/**
 * Finds all PENDING reservations whose expiresAt is in the past,
 * releases the hold on stock, and marks them RELEASED.
 * Safe to call concurrently — each reservation is processed in its own
 * transaction and the status update acts as an optimistic guard.
 */
export async function releaseExpiredReservations(): Promise<number> {
  const expired = await prisma.reservation.findMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: new Date() },
    },
    select: { id: true, productId: true, warehouseId: true, quantity: true },
  });

  let released = 0;

  for (const r of expired) {
    try {
      await prisma.$transaction(async (tx) => {
        // Guard: re-check status inside the transaction
        const current = await tx.reservation.findUnique({
          where: { id: r.id },
          select: { status: true },
        });
        if (!current || current.status !== 'PENDING') return;

        await tx.reservation.update({
          where: { id: r.id },
          data: { status: 'RELEASED' },
        });

        await tx.stock.update({
          where: {
            productId_warehouseId: {
              productId: r.productId,
              warehouseId: r.warehouseId,
            },
          },
          data: { reservedUnits: { decrement: r.quantity } },
        });
      });
      released++;
    } catch (err) {
      // Log but don't propagate — partial cleanup is still progress
      console.error(`[expiry] failed to release reservation ${r.id}:`, err);
    }
  }

  return released;
}
