// src/lib/idempotency.ts

import { prisma } from './prisma';

const KEY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface StoredResponse {
  body: unknown;
  statusCode: number;
}

export async function getIdempotentResponse(
  key: string
): Promise<StoredResponse | null> {
  const record = await prisma.idempotencyKey.findUnique({ where: { key } });
  if (!record) return null;
  if (record.expiresAt < new Date()) {
    // Stale — treat as missing (cleanup happens lazily)
    return null;
  }
  return {
    body: JSON.parse(record.responseBody),
    statusCode: record.statusCode,
  };
}

export async function storeIdempotentResponse(
  key: string,
  body: unknown,
  statusCode: number
): Promise<void> {
  const expiresAt = new Date(Date.now() + KEY_TTL_MS);
  await prisma.idempotencyKey.upsert({
    where: { key },
    create: {
      key,
      responseBody: JSON.stringify(body),
      statusCode,
      expiresAt,
    },
    update: {
      responseBody: JSON.stringify(body),
      statusCode,
      expiresAt,
    },
  });
}
