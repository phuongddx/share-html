import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { parseReferrer } from "@/lib/referrer-parser";
import { verifyTrackingToken } from "@/lib/analytics-track";
import { checkAnalyticsRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // Rate limit before any processing
    const ip =
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";

    const rateOk = await checkAnalyticsRateLimit(ip);
    if (!rateOk) {
      return NextResponse.json({ ok: true }); // silent rejection
    }

    const body = await request.json();
    const { trackingToken, shareId, referrer, isEmbed } = body as {
      trackingToken: string;
      shareId: string;
      referrer?: string;
      isEmbed?: boolean;
    };

    if (!trackingToken || !shareId) {
      return NextResponse.json({ ok: true });
    }

    // Validate shareId exists in DB
    const supabase = createAdminClient();
    const { data: share } = await supabase
      .from("shares")
      .select("id")
      .eq("id", shareId)
      .single();

    if (!share) {
      return NextResponse.json({ ok: true }); // silently ignore
    }

    // Verify signed token (proves server-side page render happened)
    const isValid = await verifyTrackingToken(trackingToken, shareId);
    if (!isValid) {
      return NextResponse.json({ ok: true }); // reject silently
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

    return NextResponse.json({ ok: true });
  } catch {
    // Always return 200 — analytics failures must be invisible to viewer
    return NextResponse.json({ ok: true });
  }
}
