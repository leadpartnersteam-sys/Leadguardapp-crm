/**
 * In-memory sliding window rate limiter suitable for Vercel Serverless / Node.js.
 *
 * NOTE ON SERVERLESS LIMITATIONS:
 * In a multi-instance serverless deployment, in-memory state is maintained per execution container.
 * For distributed multi-region enforcement across multiple concurrent lambdas at high scale,
 * an external key-value store such as Upstash Redis can be plugged in. For V1, this provides
 * strong per-container protection against burst flood attacks.
 */

interface RateBucket {
  tokens: number;
  lastRefill: number;
}

const memoryStore = new Map<string, RateBucket>();

// Periodic cleanup of stale buckets every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupStaleBuckets(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, bucket] of memoryStore.entries()) {
    if (now - bucket.lastRefill > 60 * 1000 * 10) {
      memoryStore.delete(key);
    }
  }
}

/**
 * Checks if an action is within rate limits using a token bucket algorithm.
 *
 * @param identifier Unique key (IP address or connection key)
 * @param maxTokens Maximum allowed burst requests (e.g. 60)
 * @param refillIntervalMs Window duration in milliseconds (e.g. 60000ms = 1 minute)
 */
export function checkRateLimit(
  identifier: string,
  maxTokens = 60,
  refillIntervalMs = 60000
): {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
} {
  cleanupStaleBuckets();

  const now = Date.now();
  const bucket = memoryStore.get(identifier) || {
    tokens: maxTokens,
    lastRefill: now,
  };

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill;
  if (elapsed > 0) {
    const tokensToAdd = (elapsed / refillIntervalMs) * maxTokens;
    bucket.tokens = Math.min(maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    memoryStore.set(identifier, bucket);
    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      retryAfterSeconds: 0,
    };
  }

  // Rate limit exceeded
  const timeToWaitMs = ((1 - bucket.tokens) / maxTokens) * refillIntervalMs;
  return {
    allowed: false,
    remaining: 0,
    retryAfterSeconds: Math.ceil(timeToWaitMs / 1000),
  };
}
