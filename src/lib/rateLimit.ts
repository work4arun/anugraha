/**
 * Lightweight in-memory rate limiter (fixed-window with sliding reset).
 *
 * Suitable for the current single-instance Docker deployment. If the app is
 * ever scaled to multiple instances/serverless, replace the Map with a shared
 * store (Redis) — see BUGS.md issue 16.
 *
 * Usage:
 *   const check = rateLimit(`login:${username}`, { max: 5, windowMs: 15 * 60_000 });
 *   if (!check.ok) ... reject (retry after check.retryAfterSec seconds)
 *   // on success (e.g. correct password), optionally clearRateLimit(key)
 */

type Bucket = { count: number; resetAt: number };

// Survive Next.js dev hot-reload the same way lib/prisma.ts does.
const globalForRl = globalThis as unknown as { __rateLimitBuckets?: Map<string, Bucket> };
const buckets: Map<string, Bucket> = (globalForRl.__rateLimitBuckets ??= new Map());

const MAX_BUCKETS = 50_000; // hard cap so the map can't grow unbounded

function sweep(now: number) {
  // Drop expired buckets; called opportunistically.
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
}

export interface RateLimitOptions {
  /** Maximum allowed hits inside the window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

/** Record a hit against `key` and report whether it is within the limit. */
export function rateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) sweep(now);
    bucket = { count: 0, resetAt: now + opts.windowMs };
    buckets.set(key, bucket);
  }

  bucket.count++;
  const ok = bucket.count <= opts.max;
  return {
    ok,
    remaining: Math.max(0, opts.max - bucket.count),
    retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
  };
}

/** Clear the counter for `key` (e.g. after a successful login). */
export function clearRateLimit(key: string): void {
  buckets.delete(key);
}
