/**
 * GET /api/oembed — oEmbed discovery endpoint.
 * Returns oEmbed JSON for a share URL, used by embed consumers.
 */

import { Hono } from "hono";
import { createAdminClient } from "@dropitx/shared/supabase/admin";
import { parseOembedUrl, buildOembedResponse } from "../lib/oembed-utils";
import { checkOembedRateLimit } from "../lib/rate-limit";
import type { Share } from "@dropitx/shared/types/share";
import type { AppEnv } from "../app";

const SITE_URL = process.env.APP_URL || "https://dropitx.com";
const app = new Hono<AppEnv>();

app.get("/", async (c) => {
  const url = c.req.query("url");
  const format = c.req.query("format");

  if (!url) {
    return c.json({ error: "Missing 'url' parameter" }, 400);
  }
  if (format && format !== "json") {
    return c.json({ error: "Only 'json' format is supported" }, 501);
  }

  const slug = parseOembedUrl(url);
  if (!slug) {
    return c.json({ error: "Invalid or unsupported URL" }, 404);
  }

  // Rate limit: 60 req/min per IP
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateResult = await checkOembedRateLimit(ip);
  if (!rateResult.success) {
    c.header("Retry-After", String(rateResult.reset));
    return c.json({ error: "Rate limit exceeded" }, 429);
  }

  const adminClient = createAdminClient();
  const { data: share } = await adminClient
    .from("shares")
    .select(
      "id, slug, filename, title, view_count, user_id, is_private, password_hash, user_profiles!user_id(display_name)",
    )
    .eq("slug", slug)
    .single<Share & { user_profiles: { display_name: string | null } }>();

  if (!share) {
    return c.json({ error: "Share not found" }, 404);
  }

  const ogImageUrl = `${SITE_URL}/api/og-image/${share.slug}`;
  return c.json(
    buildOembedResponse(
      { ...share, display_name: share.user_profiles?.display_name },
      SITE_URL,
      ogImageUrl,
    ),
  );
});

export default app;
