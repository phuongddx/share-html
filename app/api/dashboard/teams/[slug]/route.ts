/**
 * GET    /api/dashboard/teams/[slug] — Get team details + member count.
 * PATCH  /api/dashboard/teams/[slug] — Update team name/slug (owner only).
 * DELETE /api/dashboard/teams/[slug] — Delete team (owner only).
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { isValidTeamName, isValidTeamSlug } from "@/lib/team-utils";
import type { SupabaseClient } from "@supabase/supabase-js";

interface TeamRow {
  id: string; name: string; slug: string;
  created_by: string; plan: string; created_at: string;
}

type TeamContext =
  | { ok: true; team: TeamRow; supabase: SupabaseClient; userRole: string }
  | { ok: false; error: NextResponse };

/** Verify user is a team member and return team data + role. */
export async function requireTeamMember(
  slug: string,
  minRole?: string,
): Promise<TeamContext> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: team } = await supabase
    .from("teams").select("*").eq("slug", slug).single();
  if (!team) {
    return { ok: false, error: NextResponse.json({ error: "Team not found" }, { status: 404 }) };
  }

  const { data: member } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", (team as TeamRow).id)
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return { ok: false, error: NextResponse.json({ error: "Not a team member" }, { status: 403 }) };
  }

  if (minRole) {
    const levels: Record<string, number> = { viewer: 1, editor: 2, owner: 3 };
    if ((levels[member.role] ?? 0) < (levels[minRole] ?? 0)) {
      return { ok: false, error: NextResponse.json({ error: "Insufficient permissions" }, { status: 403 }) };
    }
  }

  return { ok: true, team: team as TeamRow, supabase, userRole: member.role };
}

/** GET — Team details with member count. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const result = await requireTeamMember(slug);
    if (!result.ok) return result.error;
    const { team, supabase } = result;

    const { count } = await supabase
      .from("team_members")
      .select("*", { count: "exact", head: true })
      .eq("team_id", team.id);

    return NextResponse.json({ ...team, member_count: count ?? 0 });
  } catch (err) {
    console.error("GET /api/dashboard/teams/[slug] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** PATCH — Update team name/slug (owner only). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const result = await requireTeamMember(slug, "owner");
    if (!result.ok) return result.error;
    const { team, supabase } = result;

    const body = await request.json();
    const { name, slug: newSlug } = body as { name?: string; slug?: string };

    const updates: Record<string, string> = {};
    if (name !== undefined) {
      if (!isValidTeamName(name)) {
        return NextResponse.json({ error: "Invalid team name" }, { status: 400 });
      }
      updates.name = name;
    }
    if (newSlug !== undefined) {
      if (!isValidTeamSlug(newSlug)) {
        return NextResponse.json({ error: "Invalid team slug" }, { status: 400 });
      }
      // Check slug doesn't conflict with another team
      const { data: existing } = await supabase
        .from("teams").select("id").eq("slug", newSlug).neq("id", team.id).single();
      if (existing) {
        return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
      }
      updates.slug = newSlug;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from("teams").update(updates).eq("id", team.id).select().single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
      }
      console.error("Team update failed:", error.message);
      return NextResponse.json({ error: "Failed to update team" }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/dashboard/teams/[slug] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** DELETE — Delete team (owner only). Cascades remove members, invites, team_shares. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const result = await requireTeamMember(slug, "owner");
    if (!result.ok) return result.error;

    const { error } = await result.supabase
      .from("teams").delete().eq("id", result.team.id);
    if (error) {
      console.error("Team delete failed:", error.message);
      return NextResponse.json({ error: "Failed to delete team" }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("DELETE /api/dashboard/teams/[slug] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
