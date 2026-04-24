/**
 * Rate limiting via Upstash Redis.
 * Upload: 10 requests per minute per IP (sliding window).
 * Password attempts: 5 per 10 minutes per IP+slug (fail-closed).
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let ratelimit: Ratelimit | null = null;
let passwordRatelimit: Ratelimit | null = null;

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

function getPasswordRatelimit(): Ratelimit {
  if (!passwordRatelimit) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token || url === "your-upstash-url") {
      throw new Error("Upstash Redis not configured");
    }
    passwordRatelimit = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(5, "600 s"),
      prefix: "pwd",
    });
  }
  return passwordRatelimit;
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

export async function checkPasswordRateLimit(
  ip: string,
  slug: string,
): Promise<{ success: boolean; remaining: number; reset: number }> {
  try {
    const rl = getPasswordRatelimit();
    const { success, remaining, reset } = await rl.limit(`${ip}:${slug}`);
    return { success, remaining, reset };
  } catch {
    // Fail-closed: deny access when rate limiter is unavailable to prevent brute force
    return { success: false, remaining: 0, reset: Date.now() + 600_000 };
  }
}
