/**
 * GET  /api/dashboard/teams — List the authenticated user's teams.
 * POST /api/dashboard/teams — Create a new team.
 * Both endpoints use cookie-based auth (dashboard routes, not API key auth).
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { generateTeamSlug, isValidTeamName, isValidTeamSlug } from "@/lib/team-utils";

/** GET — List user's teams with their role in each. */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: memberships, error } = await supabase
      .from("team_members")
      .select("role, teams(id, name, slug, plan, created_at, created_by)")
      .eq("user_id", user.id);

    if (error) {
      console.error("GET /api/dashboard/teams error:", error.message);
      return NextResponse.json({ error: "Failed to list teams" }, { status: 500 });
    }

    interface TeamRow {
      id: string; name: string; slug: string;
      plan: string; created_at: string; created_by: string;
    }
    interface MembershipRow { role: string; teams: TeamRow }

    return NextResponse.json({
      teams: (memberships as unknown as MembershipRow[] | null)?.map((m) => ({
        ...m.teams,
        role: m.role,
      })) ?? [],
    });
  } catch (err) {
    console.error("GET /api/dashboard/teams error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST — Create a new team. Creator becomes owner via DB trigger. */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { name, slug } = body as { name?: string; slug?: string };

    if (!name || !isValidTeamName(name)) {
      return NextResponse.json({ error: "Invalid team name (1-100 chars, no control chars)" }, { status: 400 });
    }

    const teamSlug = slug ?? generateTeamSlug(name);
    if (!isValidTeamSlug(teamSlug)) {
      return NextResponse.json({ error: "Invalid team slug (2-50 chars, lowercase alphanumeric + hyphens)" }, { status: 400 });
    }

    // Use admin client (bypasses RLS) for server-side writes
    const admin = createAdminClient();
    const { data: team, error } = await admin
      .from("teams")
      .insert({ name, slug: teamSlug, created_by: user.id })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Team slug already taken" }, { status: 409 });
      }
      console.error("Team creation failed:", error.message);
      return NextResponse.json({ error: "Failed to create team" }, { status: 500 });
    }

    // Owner membership is auto-created by the add_team_owner DB trigger
    return NextResponse.json({ team, role: "owner" }, { status: 201 });
  } catch (err) {
    console.error("POST /api/dashboard/teams error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
