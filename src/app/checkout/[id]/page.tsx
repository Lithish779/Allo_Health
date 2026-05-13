// src/app/checkout/[id]/page.tsx

import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { CheckoutClient } from '@/components/CheckoutClient';
import type { Reservation } from '@/types';

async function getReservation(id: string): Promise<Reservation | null> {
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { product: true, warehouse: true },
  });

  if (!reservation) return null;

  return {
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
      createdAt: reservation.product.createdAt.toISOString(),
      updatedAt: reservation.product.updatedAt.toISOString(),
    },
    warehouse: {
      id: reservation.warehouse.id,
      name: reservation.warehouse.name,
      location: reservation.warehouse.location,
    },
  };
}

export default async function CheckoutPage({ params }: { params: { id: string } }) {
  const reservation = await getReservation(params.id);
  if (!reservation) notFound();

  return <CheckoutClient initialReservation={reservation} />;
}
