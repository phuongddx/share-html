/**
 * GET    /api/dashboard/teams/[slug]/members — List team members with profiles.
 * PATCH  /api/dashboard/teams/[slug]/members — Update member role via RPC (owner only).
 * DELETE /api/dashboard/teams/[slug]/members — Remove member via RPC or leave team.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeamMember } from "../route";

interface MemberRow {
  team_id: string; user_id: string; role: string;
  invited_at: string; joined_at: string;
  user_profiles?: { display_name: string | null; avatar_url: string | null } | null;
}

/** GET — List all members with profile information. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const result = await requireTeamMember(slug);
    if (!result.ok) return result.error;
    const { team, supabase } = result;

    const { data: members, error } = await supabase
      .from("team_members")
      .select("team_id, user_id, role, invited_at, joined_at, user_profiles(display_name, avatar_url)")
      .eq("team_id", team.id)
      .order("joined_at", { ascending: true });

    if (error) {
      console.error("List members failed:", error.message);
      return NextResponse.json({ error: "Failed to list members" }, { status: 500 });
    }

    return NextResponse.json({
      members: (members as unknown as MemberRow[] | null)?.map((m) => ({
        team_id: m.team_id,
        user_id: m.user_id,
        role: m.role,
        invited_at: m.invited_at,
        joined_at: m.joined_at,
        display_name: m.user_profiles?.display_name ?? null,
        avatar_url: m.user_profiles?.avatar_url ?? null,
      })) ?? [],
    });
  } catch (err) {
    console.error("GET /api/dashboard/teams/[slug]/members error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** PATCH — Update a member's role via RPC (owner only). */
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
    const { user_id, role } = body as { user_id?: string; role?: string };

    if (!user_id || typeof user_id !== "string") {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }
    if (!["owner", "editor", "viewer"].includes(role ?? "")) {
      return NextResponse.json({ error: "Invalid role (must be owner, editor, or viewer)" }, { status: 400 });
    }

    const { error } = await supabase.rpc("change_member_role", {
      p_team_id: team.id,
      p_user_id: user_id,
      p_new_role: role,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      const status = msg.includes("not found") ? 404
        : msg.includes("only") ? 403
        : msg.includes("last owner") || msg.includes("cannot") ? 403
        : 500;
      console.error("RPC change_member_role failed:", error.message);
      return NextResponse.json({ error: error.message }, { status });
    }

    return NextResponse.json({ user_id, role });
  } catch (err) {
    console.error("PATCH /api/dashboard/teams/[slug]/members error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** DELETE — Remove a member via RPC (owner can remove anyone; non-owners leave). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const result = await requireTeamMember(slug);
    if (!result.ok) return result.error;
    const { team, supabase, userRole } = result;

    const { searchParams } = request.nextUrl;
    const targetUserId = searchParams.get("user_id");

    if (!targetUserId) {
      return NextResponse.json({ error: "user_id query parameter is required" }, { status: 400 });
    }

    // Owner can remove anyone; non-owners can only remove themselves (leave)
    const currentUserId = (await supabase.auth.getUser()).data.user?.id;
    if (targetUserId !== currentUserId && userRole !== "owner") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { error } = await supabase.rpc("remove_team_member", {
      p_team_id: team.id,
      p_user_id: targetUserId,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      const status = msg.includes("not found") ? 404
        : msg.includes("only") ? 403
        : msg.includes("last owner") || msg.includes("cannot") ? 403
        : 500;
      console.error("RPC remove_team_member failed:", error.message);
      return NextResponse.json({ error: error.message }, { status });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("DELETE /api/dashboard/teams/[slug]/members error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
