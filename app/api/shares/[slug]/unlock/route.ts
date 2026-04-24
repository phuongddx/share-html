/**
 * POST /api/shares/[slug]/unlock — Verify password and set access cookie.
 *
 * Rate limited: 5 attempts per 10 minutes per IP+slug (fail-closed).
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { verifyPassword } from "@/lib/password";
import { setAccessCookie } from "@/lib/share-access-cookie";
import { checkPasswordRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/api-utils";
import type { Share } from "@/types/share";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const ip = getClientIp(request);

    const rateResult = await checkPasswordRateLimit(ip, slug);
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429 },
      );
    }

    let body: { password?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { password } = body;
    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "password is required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: share, error } = await supabase
      .from("shares")
      .select("id, slug, password_hash")
      .eq("slug", slug)
      .single<Pick<Share, "id" | "slug" | "password_hash">>();

    if (error || !share) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    if (!share.password_hash) {
      return NextResponse.json(
        { error: "This share is not password-protected" },
        { status: 400 },
      );
    }

    const valid = await verifyPassword(password, share.password_hash);
    if (!valid) {
      return NextResponse.json(
        { error: "Wrong password", remaining: rateResult.remaining },
        { status: 401 },
      );
    }

    await setAccessCookie(slug);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/shares/[slug]/unlock error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
