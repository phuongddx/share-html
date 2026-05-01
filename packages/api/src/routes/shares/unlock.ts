/**
 * POST /api/v1/shares/:slug/unlock — Verify password and set access cookie.
 *
 * Public route (no auth middleware).
 * Rate limited: 5 attempts per 10 minutes per IP+slug (fail-closed).
 */

import { Hono } from "hono";
import { createAdminClient } from "@dropitx/shared/supabase/admin";
import {
  shareAccessCookieName,
  generateAccessValue,
  SHARE_ACCESS_COOKIE_MAX_AGE,
} from "@dropitx/shared/share-access-cookie";
import { verifyPassword } from "../../lib/password";
import { checkPasswordRateLimit } from "../../lib/rate-limit";
import { getClientIp } from "../../lib/api-utils";
import type { Share } from "@dropitx/shared/types/share";
import type { AppEnv } from "../../app";

const app = new Hono<AppEnv>();

app.post("/:slug/unlock", async (c) => {
  const slug = c.req.param("slug");
  const ip = getClientIp(c);

  const rateResult = await checkPasswordRateLimit(ip, slug);
  if (!rateResult.success) {
    return c.json({ error: "Too many attempts. Try again later." }, 429);
  }

  let body: { password?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }

  const { password } = body;
  if (!password || typeof password !== "string") {
    return c.json({ error: "password is required" }, 400);
  }

  const supabase = createAdminClient();
  const { data: share, error } = await supabase
    .from("shares")
    .select("id, slug, password_hash")
    .eq("slug", slug)
    .single<Pick<Share, "id" | "slug" | "password_hash">>();

  if (error || !share) {
    return c.json({ error: "Share not found" }, 404);
  }

  if (!share.password_hash) {
    return c.json({ error: "This share is not password-protected" }, 400);
  }

  const valid = await verifyPassword(password, share.password_hash);
  if (!valid) {
    return c.json(
      { error: "Wrong password", remaining: rateResult.remaining },
      401,
    );
  }

  // Set access cookie
  const exp = Math.floor(Date.now() / 1000) + SHARE_ACCESS_COOKIE_MAX_AGE;
  const value = generateAccessValue(slug, exp);
  c.header(
    "Set-Cookie",
    `${shareAccessCookieName(slug)}=${value}; Path=/; SameSite=Lax; Max-Age=${SHARE_ACCESS_COOKIE_MAX_AGE}`,
  );

  return c.json({ success: true });
});

export default app;
