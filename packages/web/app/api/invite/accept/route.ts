/**
 * POST /api/invite/accept — Accept a team invite via RPC.
 * Cookie-based auth. RPC handles email match, membership creation, and invite acceptance.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { token?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { token } = body;
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("accept_team_invite", {
      p_token: token,
      p_user_email: user.email,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      const status = msg.includes("not found")
        ? 404
        : msg.includes("already accepted")
          ? 409
          : msg.includes("expired")
            ? 410
            : msg.includes("revoked")
              ? 410
              : msg.includes("sent to")
                ? 403
                : msg.includes("no longer valid")
                  ? 410
                  : 500;
      return NextResponse.json({ error: error.message }, { status });
    }

    return NextResponse.json({
      ok: true,
      team_slug: data.team_slug,
      already_member: data.already_member,
    });
  } catch (err) {
    console.error("POST /api/invite/accept error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
