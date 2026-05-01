/**
 * Rate limiting via Supabase Postgres RPC.
 * Upload: 10 requests per minute per IP (sliding window).
 * Password attempts: 5 per 10 minutes per IP+slug (fail-closed).
 */

import { createAdminClient } from "@dropitx/shared/supabase/admin";

type RateLimitRow = { success: boolean; remaining: number; reset_at: string };

async function callRateLimit(
  key: string,
  maxAttempts: number,
  windowSecs: number,
): Promise<RateLimitRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: key,
    p_max_attempts: maxAttempts,
    p_window_secs: windowSecs,
  });
  if (error) throw error;
  return (data as RateLimitRow[])[0];
}

export async function checkRateLimit(ip: string): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  try {
    const row = await callRateLimit(`upload:${ip}`, 10, 60);
    return {
      success: row.success,
      limit: 10,
      remaining: row.remaining,
      reset: new Date(row.reset_at).getTime(),
    };
  } catch {
    return { success: true, limit: 10, remaining: 10, reset: Date.now() };
  }
}

export async function checkOembedRateLimit(ip: string): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  try {
    const row = await callRateLimit(`oembed:${ip}`, 60, 60);
    return {
      success: row.success,
      limit: 60,
      remaining: row.remaining,
      reset: new Date(row.reset_at).getTime(),
    };
  } catch {
    return { success: true, limit: 60, remaining: 60, reset: Date.now() };
  }
}

export async function checkPasswordRateLimit(
  ip: string,
  slug: string,
): Promise<{ success: boolean; remaining: number; reset: number }> {
  try {
    const row = await callRateLimit(`pwd:${ip}:${slug}`, 5, 600);
    return {
      success: row.success,
      remaining: row.remaining,
      reset: new Date(row.reset_at).getTime(),
    };
  } catch {
    return { success: false, remaining: 0, reset: Date.now() + 600_000 };
  }
}

/** Analytics tracking: 60 requests per minute per IP (fail-open). */
export async function checkAnalyticsRateLimit(ip: string): Promise<boolean> {
  try {
    const row = await callRateLimit(`analytics:${ip}`, 60, 60);
    return row.success;
  } catch {
    return true;
  }
}

/** Extract client IP from Hono Context. */
export function getClientIp(c: {
  req: { header: (name: string) => string | undefined };
}): string {
  const realIp = c.req.header("x-real-ip");
  if (realIp) return realIp;

  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const entries = forwarded.split(",").map((s) => s.trim());
    return entries[entries.length - 1];
  }

  return "unknown";
}
