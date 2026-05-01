import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@dropitx/shared/supabase/admin";
import { parseOembedUrl, buildOembedResponse } from "@/lib/oembed-utils";
import { checkOembedRateLimit } from "@/lib/rate-limit";
import type { Share } from "@dropitx/shared/types/share";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://dropitx.com";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const format = searchParams.get("format");

  if (!url) {
    return NextResponse.json({ error: "Missing 'url' parameter" }, { status: 400 });
  }
  if (format && format !== "json") {
    return NextResponse.json({ error: "Only 'json' format is supported" }, { status: 501 });
  }

  const slug = parseOembedUrl(url);
  if (!slug) {
    return NextResponse.json({ error: "Invalid or unsupported URL" }, { status: 404 });
  }

  // Rate limit: 60 req/min per IP
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const rateResult = await checkOembedRateLimit(ip);
  if (!rateResult.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rateResult.reset) } },
    );
  }

  const adminClient = createAdminClient();
  // Red Team Fix: 6 — join user_profiles for display_name instead of exposing raw user_id UUID
  const { data: share } = await adminClient
    .from("shares")
    .select(
      "id, slug, filename, title, view_count, user_id, is_private, password_hash, user_profiles!user_id(display_name)",
    )
    .eq("slug", slug)
    .single<Share & { user_profiles: { display_name: string | null } }>();

  if (!share) {
    return NextResponse.json({ error: "Share not found" }, { status: 404 });
  }

  const ogImageUrl = `${SITE_URL}/api/og-image/${share.slug}`;
  return NextResponse.json(
    buildOembedResponse(
      { ...share, display_name: share.user_profiles?.display_name },
      SITE_URL,
      ogImageUrl,
    ),
  );
}
