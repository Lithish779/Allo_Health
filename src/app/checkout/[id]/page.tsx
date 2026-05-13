// src/app/checkout/[id]/page.tsx

import { notFound } from 'next/navigation';
import { CheckoutClient } from '@/components/CheckoutClient';
import type { Reservation } from '@/types';

async function getReservation(id: string): Promise<Reservation | null> {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  const res = await fetch(`${baseUrl}/api/reservations/${id}`, {
    cache: 'no-store',
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch reservation');
  return res.json();
}

export default async function CheckoutPage({ params }: { params: { id: string } }) {
  const reservation = await getReservation(params.id);
  if (!reservation) notFound();

  return <CheckoutClient initialReservation={reservation} />;
}
