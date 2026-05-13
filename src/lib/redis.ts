// src/lib/redis.ts

import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL environment variable is not set');
  }
  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: true,
  });
  client.on('error', (err) => {
    // Don't crash the process on Redis errors — log and let callers handle
    console.error('[Redis] connection error:', err.message);
  });
  return client;
}

export const redis: Redis =
  globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

// Acquire a distributed lock. Returns true if acquired, false otherwise.
// TTL is in milliseconds.
export async function acquireLock(key: string, ttlMs: number): Promise<boolean> {
  const result = await redis.set(key, '1', 'PX', ttlMs, 'NX');
  return result === 'OK';
}

export async function releaseLock(key: string): Promise<void> {
  await redis.del(key);
}

export function stockLockKey(productId: string, warehouseId: string): string {
  return `lock:stock:${productId}:${warehouseId}`;
}
