/**
 * Hono middleware wrappers for rate limiting.
 * Uses Supabase Postgres RPC (no Upstash/Redis deps).
 */

import { createMiddleware } from "hono/factory";
import { checkRateLimit, checkOembedRateLimit, checkPasswordRateLimit, checkAnalyticsRateLimit } from "../lib/rate-limit";
import type { AppEnv } from "../app";

/** Extract IP from request (supports Vercel's x-forwarded-for). */
function extractIp(c: import("hono").Context<AppEnv>): string {
  return c.req.header("x-forwarded-for")?.split(",")[0].trim() ||
         c.req.header("x-real-ip") ||
         "unknown";
}

/**
 * General rate limit middleware (10 req/min per IP).
 * Returns 429 when limit exceeded with retry-after header.
 */
export const rateLimit = createMiddleware<AppEnv>(async (c, next) => {
  const ip = extractIp(c);
  const result = await checkRateLimit(ip);

  c.header("X-RateLimit-Limit", String(result.limit));
  c.header("X-RateLimit-Remaining", String(result.remaining));
  c.header("X-RateLimit-Reset", String(result.reset));

  if (!result.success) {
    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
    c.header("Retry-After", String(retryAfter));
    return c.json({ error: "Rate limit exceeded" }, 429);
  }

  await next();
});

/**
 * oEmbed rate limit (60 req/min per IP).
 */
export const oembedRateLimit = createMiddleware<AppEnv>(async (c, next) => {
  const ip = extractIp(c);
  const result = await checkOembedRateLimit(ip);

  c.header("X-RateLimit-Limit", String(result.limit));
  c.header("X-RateLimit-Remaining", String(result.remaining));
  c.header("X-RateLimit-Reset", String(result.reset));

  if (!result.success) {
    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
    c.header("Retry-After", String(retryAfter));
    return c.json({ error: "Rate limit exceeded" }, 429);
  }

  await next();
});

/**
 * Password attempt rate limit (5 per 10min per IP+slug).
 * Expects c.var.slug to be set (use before route handler).
 */
export const passwordRateLimit = createMiddleware<AppEnv>(async (c, next) => {
  const ip = extractIp(c);
  const slug = c.req.param("slug");

  if (!slug) {
    return c.json({ error: "Slug required for rate limiting" }, 400);
  }

  const result = await checkPasswordRateLimit(ip, slug);

  c.header("X-RateLimit-Remaining", String(result.remaining));
  c.header("X-RateLimit-Reset", String(result.reset));

  if (!result.success) {
    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
    c.header("Retry-After", String(retryAfter));
    return c.json({ error: "Too many password attempts. Try again later." }, 429);
  }

  await next();
});

/**
 * Analytics rate limit (60 req/min per IP).
 * Silent fail — doesn't return 429, just logs when throttled.
 */
export const analyticsRateLimit = createMiddleware<AppEnv>(async (c, next) => {
  const ip = extractIp(c);
  const allowed = await checkAnalyticsRateLimit(ip);

  if (!allowed) {
    // Silently skip analytics tracking when rate limited
    c.header("X-RateLimit-Throttled", "true");
    return c.json({ tracked: false, reason: "rate_limited" }, 200);
  }

  await next();
});
