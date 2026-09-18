/**
 * A small in-memory rate limiter.
 *
 * WHAT IT IS FOR
 * Endpoints that write citizen-supplied content — road reports, sensor
 * detections — need a ceiling. Without one, a single account can fill the
 * database with junk, and on a free Postgres plan with a half-gigabyte limit
 * that is an availability problem, not just an annoyance.
 *
 * HONEST LIMITATION
 * This counter lives in the memory of one server process. On Vercel that means
 * each serverless instance keeps its own tally, so somebody determined enough
 * could get more requests through than the limit suggests by spreading them
 * across cold starts. It also resets on every deploy.
 *
 * It is still worth having: it stops the realistic problems (a stuck retry
 * loop, a double-tapped button, one enthusiastic person) at zero cost and with
 * no extra service. A deployment that needed a real guarantee would put this in
 * Postgres or a Redis-compatible store — the function signature would not
 * change, only its body.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Stops the map growing without bound in a long-lived process. */
const MAX_TRACKED_KEYS = 5_000;

export interface RateLimitResult {
  allowed: boolean;
  /** Requests left in the current window. */
  remaining: number;
  /** Seconds until the window resets. */
  retryAfterSeconds: number;
}

/**
 * @param key       what to count against, e.g. `road-report:<userId>`
 * @param limit     how many requests are allowed in the window
 * @param windowMs  how long the window is
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    if (buckets.size >= MAX_TRACKED_KEYS) evictExpired(now);

    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: limit - existing.count,
    retryAfterSeconds: 0,
  };
}

function evictExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }

  // If everything is still live, drop the oldest entries rather than grow.
  if (buckets.size >= MAX_TRACKED_KEYS) {
    const oldest = [...buckets.entries()]
      .sort((a, b) => a[1].resetAt - b[1].resetAt)
      .slice(0, Math.floor(MAX_TRACKED_KEYS / 4));

    for (const [key] of oldest) buckets.delete(key);
  }
}
