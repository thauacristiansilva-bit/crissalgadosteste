import { createHash } from "node:crypto"

type RateBucket = {
  failures: number
  resetAt: number
}

type RateLimitState = {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

declare global {
  // eslint-disable-next-line no-var
  var __saborflowAuthRateBuckets: Map<string, RateBucket> | undefined
}

const buckets =
  globalThis.__saborflowAuthRateBuckets || new Map<string, RateBucket>()

globalThis.__saborflowAuthRateBuckets = buckets

function keyFor(scope: string, value: string) {
  const digest = createHash("sha256")
    .update(value.trim().toLowerCase())
    .digest("hex")
  return `${scope}:${digest}`
}

function cleanExpired(now: number) {
  if (buckets.size < 500) return
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export function authRateLimitKey(scope: "ip" | "account", value: string) {
  return keyFor(scope, value || "unknown")
}

export function checkAuthRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitState {
  const now = Date.now()
  cleanExpired(now)

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    return {
      allowed: true,
      remaining: limit,
      retryAfterSeconds: 0,
    }
  }

  const allowed = bucket.failures < limit
  return {
    allowed,
    remaining: Math.max(0, limit - bucket.failures),
    retryAfterSeconds: allowed
      ? 0
      : Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  }
}

export function registerAuthFailure(
  key: string,
  windowMs: number,
) {
  const now = Date.now()
  const current = buckets.get(key)

  if (!current || current.resetAt <= now) {
    buckets.set(key, {
      failures: 1,
      resetAt: now + windowMs,
    })
    return
  }

  current.failures += 1
  buckets.set(key, current)
}

export function clearAuthFailures(key: string) {
  buckets.delete(key)
}
