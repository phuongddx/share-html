/** POST /api/invite/decline — Decline a team invite via RPC. */

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
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { token } = body;
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("decline_team_invite", {
      p_token: token,
      p_user_email: user.email,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      const status = msg.includes("not found")
        ? 404
        : msg.includes("expired")
          ? 410
          : msg.includes("already")
            ? 410
            : msg.includes("%")
              ? 403
              : 500;
      return NextResponse.json({ error: error.message }, { status });
    }

    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ ok: true, team_slug: row?.team_slug });
  } catch (err) {
    console.error("POST /api/invite/decline error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
