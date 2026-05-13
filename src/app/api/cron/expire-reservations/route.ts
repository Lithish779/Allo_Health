// src/app/api/cron/expire-reservations/route.ts
// Call this from Vercel Cron or any external scheduler every minute.
// Protected by a shared secret in the Authorization header.

import { NextRequest, NextResponse } from 'next/server';
import { releaseExpiredReservations } from '@/lib/expiry';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const released = await releaseExpiredReservations();
    return NextResponse.json({ ok: true, released, timestamp: new Date().toISOString() });
  } catch (err: any) {
    console.error('[CRON] failed:', err.message);
    return NextResponse.json({ error: 'Failed to expire reservations', details: err.message }, { status: 500 });
  }
}
