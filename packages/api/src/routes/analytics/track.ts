/**
 * POST /api/analytics/track — Client-side analytics ping.
 * Records referrer data for the most recent share view.
 * Always returns { ok: true } — analytics failures must be invisible.
 */

import { Hono } from "hono";
import { createAdminClient } from "@dropitx/shared/supabase/admin";
import { parseReferrer } from "../../lib/referrer-parser";
import { verifyTrackingToken } from "@dropitx/shared/analytics-track";
import { checkAnalyticsRateLimit } from "../../lib/rate-limit";
import type { AppEnv } from "../../app";

const app = new Hono<AppEnv>();

app.post("/", async (c) => {
  try {
    const ip =
      c.req.header("cf-connecting-ip") ??
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";

    const rateOk = await checkAnalyticsRateLimit(ip);
    if (!rateOk) {
      return c.json({ ok: true }); // silent rejection
    }

    const body = await c.req.json();
    const { trackingToken, shareId, referrer, isEmbed } = body as {
      trackingToken: string;
      shareId: string;
      referrer?: string;
      isEmbed?: boolean;
    };

    if (!trackingToken || !shareId) {
      return c.json({ ok: true });
    }

    // Validate shareId exists in DB
    const supabase = createAdminClient();
    const { data: share } = await supabase
      .from("shares")
      .select("id")
      .eq("id", shareId)
      .single();

    if (!share) {
      return c.json({ ok: true }); // silently ignore
    }

    // Verify signed token (proves server-side page render happened)
    const isValid = await verifyTrackingToken(trackingToken, shareId);
    if (!isValid) {
      return c.json({ ok: true }); // reject silently
    }

    // Update the most recent share_views row with client-side referrer data
    const referrerSource = parseReferrer(referrer ?? null, !!isEmbed);
    await supabase
      .from("share_views")
      .update({
        referrer: referrer ?? null,
        referrer_source: referrerSource,
      })
      .eq("share_id", shareId)
      .order("viewed_at", { ascending: false })
      .limit(1);

    return c.json({ ok: true });
  } catch {
    // Always return 200 — analytics failures must be invisible to viewer
    return c.json({ ok: true });
  }
});

export default app;
