# Allo Inventory

Multi-warehouse inventory and reservation platform built for the Allo engineering take-home exercise.

---

## Running locally

### 1. Prerequisites

- Node.js 18+
- A hosted Postgres instance (Supabase / Neon / Railway — free tiers all work)
- A Redis instance (Upstash free tier, or `docker run -p 6379:6379 redis` locally)

### 2. Clone and install

```bash
git clone <your-repo-url>
cd allo-inventory
npm install
```

### 3. Environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string (must include `?sslmode=require` for hosted) |
| `REDIS_URL` | Redis connection string (`redis://` or `rediss://` for TLS) |
| `NEXT_PUBLIC_BASE_URL` | Full URL of the app, e.g. `http://localhost:3000` |
| `CRON_SECRET` | Optional secret to protect the expiry cron endpoint |

### 4. Database setup

```bash
# Generate the Prisma client
npm run db:generate

# Run migrations against your hosted Postgres
npm run db:migrate

# Seed with 6 products, 3 warehouses, 18 stock records
npm run db:seed
```

### 5. Start the dev server

```bash
npm run dev
# → http://localhost:3000
```

---

## How the expiry mechanism works in production

Reservations have an `expiresAt` timestamp set 10 minutes in the future when created. There are two complementary mechanisms that release expired holds:

### Primary: Vercel Cron (`vercel.json`)

```json
{
  "crons": [{ "path": "/api/cron/expire-reservations", "schedule": "* * * * *" }]
}
```

This runs `GET /api/cron/expire-reservations` every minute. The handler queries for all `PENDING` reservations whose `expiresAt < now()`, and for each one runs a transaction that:
1. Re-checks the status inside the transaction (guard against racing cleanup workers).
2. Decrements `reservedUnits` on the stock row.
3. Sets the reservation status to `RELEASED`.

The endpoint is protected by an `Authorization: Bearer <CRON_SECRET>` header that Vercel sends automatically.

### Secondary: Lazy cleanup on reads

`GET /api/products` also calls `releaseExpiredReservations()` before returning data. This means even if the cron misses a cycle, the next product listing fetch will clean up stale holds and show accurate available counts. It adds a small amount of latency to the products endpoint but keeps the visible stock accurate.

### Why not a long-running background worker?

Vercel's serverless environment doesn't support persistent processes. The cron + lazy-read approach is idiomatic for the platform and requires no extra infrastructure beyond what the rest of the app already needs.

---

## How the race condition is prevented

This is the core of the exercise. The problem: two concurrent requests both read "1 unit available" and both try to reserve it.

### The approach: Redis distributed lock + Postgres transaction

**Step 1 — Distributed lock per SKU**

Before touching the database, `POST /api/reservations` acquires a Redis lock scoped to `(productId, warehouseId)`:

```
SET lock:stock:{productId}:{warehouseId} 1 PX 5000 NX
```

`NX` means "only set if the key doesn't exist." If two requests race, exactly one gets `OK`; the other gets `null` and immediately returns 503. The lock TTL is 5 seconds — more than enough for the database transaction, and short enough that a crashed process won't hold the lock indefinitely.

**Step 2 — Re-check availability inside a Postgres transaction**

Even with the lock, we re-read the stock row *inside* a transaction before incrementing. This provides a second layer of safety: if the Redis lock is ever unavailable (Redis down, network blip), the database is still the source of truth. The transaction reads the live `totalUnits - reservedUnits` and only proceeds if enough stock is available.

```sql
BEGIN;
  SELECT total_units, reserved_units FROM stock WHERE ... FOR UPDATE;
  -- if available < requested → rollback, return 409
  UPDATE stock SET reserved_units = reserved_units + qty WHERE ...;
  INSERT INTO reservations (...) VALUES (...);
COMMIT;
```

The `FOR UPDATE` row-lock on the stock row means two transactions that both bypass the Redis lock (edge case) still serialize correctly at the database level.

**Step 3 — Release the lock in `finally`**

The Redis lock is always released after the transaction, whether it succeeded or failed, via a `finally` block.

---

## Idempotency (bonus)

Both `POST /api/reservations` and `POST /api/reservations/:id/confirm` support idempotent retries via the `Idempotency-Key` request header.

On the first request with a given key:
- The request is processed normally.
- The response body and HTTP status code are stored in the `idempotency_keys` Postgres table, keyed by the header value.
- Keys expire after 24 hours.

On subsequent requests with the same key:
- The stored response is returned immediately, without re-running any business logic or modifying any data.

This means a client that retries a reservation request after a network timeout will not accidentally create two reservations. The key should be a UUID generated client-side per logical operation (not per HTTP request).

---

## Architecture overview

```
Browser
  │
  ├── GET  /                        → ProductGrid (server component, no-store)
  │         └── GET /api/products   → Prisma query + lazy expiry cleanup
  │
  ├── POST /api/reservations        → Redis lock → Prisma transaction → 201 | 409
  │
  ├── GET  /checkout/:id            → CheckoutClient (client component)
  │         ├── POST .../confirm    → Prisma transaction → 200 | 410
  │         └── POST .../release    → Prisma transaction → 200
  │
  └── GET  /api/cron/expire-reservations  → releaseExpiredReservations()
```

---

## Trade-offs and things I'd do differently with more time

**What I'd add:**

- **Optimistic UI updates on the product page.** Currently the page does a full `router.refresh()` pattern after a reservation. With more time I'd add a local state overlay so the stock count updates immediately without a network round-trip.

- **Retry logic with exponential backoff on the client.** The 503 from a busy lock is transient; a real client should retry it automatically.

- **Better observability.** I'd add structured logging (Pino or similar) and instrument the lock contention rate, so ops can see how often two requests race for the same SKU.

- **Tests.** The concurrency guarantee is the most important correctness property and the hardest to test manually. I'd write integration tests that fire N concurrent reservation requests for a SKU with 1 unit remaining and assert exactly one 201 and N-1 409s.

- **Pagination on the product list.** Fine for a seed dataset; would break at scale.

**Conscious trade-offs:**

- **Redis is a soft dependency.** If `REDIS_URL` is wrong or Redis is down, the reservation endpoint will error. An alternative design would degrade gracefully to pure-Postgres locking (`SELECT ... FOR UPDATE SKIP LOCKED`), which is sufficient for moderate load without Redis. I opted for Redis because the spec mentioned it and it's the cleaner solution at scale.

- **Lazy expiry adds latency to the products endpoint.** The trade-off is accuracy vs. speed. For a product listing page where accurate stock numbers matter more than P99 latency, this felt like the right call.

- **No authentication.** The spec didn't ask for it. In production every reservation would be tied to a user session.
