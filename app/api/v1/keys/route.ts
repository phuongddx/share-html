/**
 * POST /api/v1/keys — Generate a new API key (cookie auth, NOT API key auth).
 * GET  /api/v1/keys — List the authenticated user's API keys (cookie auth).
 *
 * Team support: POST accepts optional team_id to create a team-scoped API key.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/server";
import { generateApiKey } from "@/lib/api-key";
import { hasMinRole } from "@/lib/team-utils";
import type { TeamRole } from "@/types/team";

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
    const { name, team_id } = body as { name?: string; team_id?: string };

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 },
      );
    }

    const trimmedName = name.trim().slice(0, 100);
    const supabase = createAdminClient();

    // Determine prefix: team key uses "sht", personal uses "shk"
    let prefix: "shk" | "sht" = "shk";
    let keyTeamId: string | null = null;

    if (team_id) {
      // Validate user is editor+ in the team
      const { data: member } = await supabase
        .from("team_members")
        .select("role")
        .eq("team_id", team_id)
        .eq("user_id", user.id)
        .single();

      if (!member || !hasMinRole(member.role as TeamRole, "editor")) {
        return NextResponse.json(
          { error: "Insufficient permissions to create team API key" },
          { status: 403 },
        );
      }

      prefix = "sht";
      keyTeamId = team_id;
    }

    const { key, hash, prefix: keyPrefix } = generateApiKey(prefix);

    const { error } = await supabase.from("api_keys").insert({
      user_id: user.id,
      name: trimmedName,
      key_hash: hash,
      key_prefix: keyPrefix,
      team_id: keyTeamId,
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
        prefix: keyPrefix,
        name: trimmedName,
        team_id: keyTeamId,
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
      .select("id, name, key_prefix, team_id, last_used_at, created_at")
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
