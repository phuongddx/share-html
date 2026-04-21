/**
 * Rate limiting via Upstash Redis.
 * Allows 10 uploads per minute per IP address using a sliding window.
 * Gracefully skips rate limiting when Upstash env vars are not configured.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let ratelimit: Ratelimit | null = null;

function getRatelimit(): Ratelimit {
  if (!ratelimit) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token || url === "your-upstash-url") {
      throw new Error("Upstash Redis not configured");
    }
    ratelimit = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(10, "60 s"),
    });
  }
  return ratelimit;
}

export async function checkRateLimit(ip: string): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  try {
    const rl = getRatelimit();
    const { success, limit, remaining, reset } = await rl.limit(ip);
    return { success, limit, remaining, reset };
  } catch {
    // Skip rate limiting when Upstash is not configured (dev/build)
    return { success: true, limit: 10, remaining: 10, reset: Date.now() };
  }
}
