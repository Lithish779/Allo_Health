// src/app/api/warehouses/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const warehouses = await prisma.warehouse.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(warehouses);
  } catch (err: any) {
    console.error('[GET /api/warehouses] failed:', err.message);
    return NextResponse.json({ error: 'Database connection failed' }, { status: 200 });
  }
}
