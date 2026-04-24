/**
 * POST /api/v1/keys — Generate a new API key (cookie auth, NOT API key auth).
 * GET  /api/v1/keys — List the authenticated user's API keys (cookie auth).
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/server";
import { generateApiKey } from "@/lib/api-key";

export async function POST(request: NextRequest) {
  try {
    // Cookie-based auth — NOT API key auth
    const cookieStore = await cookies();
    const authClient = createClient(cookieStore);
    const { data: { user } } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body as { name?: string };

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 },
      );
    }

    const trimmedName = name.trim().slice(0, 100);
    const { key, hash, prefix } = generateApiKey();

    const supabase = createAdminClient();
    const { error } = await supabase.from("api_keys").insert({
      user_id: user.id,
      name: trimmedName,
      key_hash: hash,
      key_prefix: prefix,
    });

    if (error) {
      console.error("API key insert failed:", error.message);
      return NextResponse.json(
        { error: "Failed to create API key" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        key,
        prefix,
        name: trimmedName,
        created_at: new Date().toISOString(),
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST /api/v1/keys error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const authClient = createClient(cookieStore);
    const { data: { user } } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("api_keys")
      .select("id, name, key_prefix, last_used_at, created_at")
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("API keys list failed:", error.message);
      return NextResponse.json(
        { error: "Failed to list API keys" },
        { status: 500 },
      );
    }

    return NextResponse.json({ keys: data });
  } catch (err) {
    console.error("GET /api/v1/keys error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
