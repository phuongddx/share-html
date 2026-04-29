/**
 * GET    /api/dashboard/teams/[slug]/invites — List pending invites.
 * POST   /api/dashboard/teams/[slug]/invites — Create a new invite (editor+ only) via RPC.
 * DELETE /api/dashboard/teams/[slug]/invites — Revoke a pending invite (editor+ only) via RPC.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeamMember } from "../route";
import type { TeamRole } from "@/types/team";

/** GET — List invites for this team (all members can view). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const result = await requireTeamMember(slug);
    if (!result.ok) return result.error;
    const { team, supabase } = result;

    const { data: invites, error } = await supabase
      .from("team_invites")
      .select("id, email, role, status, expires_at, created_at, invited_by")
      .eq("team_id", team.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("List invites failed:", error.message);
      return NextResponse.json({ error: "Failed to list invites" }, { status: 500 });
    }

    return NextResponse.json({ invites: invites ?? [] });
  } catch (err) {
    console.error("GET /api/dashboard/teams/[slug]/invites error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST — Create an invite via RPC (editor+ only). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const result = await requireTeamMember(slug, "editor");
    if (!result.ok) return result.error;
    const { team, supabase, userRole } = result;

    const body = await request.json();
    const { email, role } = body as { email?: string; role?: string };

    // Validate email
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    // Validate role
    const inviteRole: TeamRole = (["owner", "editor", "viewer"].includes(role ?? "") ? role : "viewer") as TeamRole;
    // Only owners can invite as owner
    if (inviteRole === "owner" && userRole !== "owner") {
      return NextResponse.json({ error: "Only owners can invite new owners" }, { status: 403 });
    }

    const { data, error } = await supabase.rpc("create_team_invite", {
      p_team_id: team.id,
      p_email: email.toLowerCase().trim(),
      p_role: inviteRole,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      const status = msg.includes("rate limit")
        ? 429
        : msg.includes("already exists")
          ? 409
          : msg.includes("only")
            ? 403
            : msg.includes("limited to") || msg.includes("plan")
              ? 403
              : 500;
      console.error("RPC create_team_invite failed:", error.message);
      return NextResponse.json({ error: error.message }, { status });
    }

    // Build the invite URL from the token returned by RPC
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://dropitx.com";
    const inviteUrl = `${appUrl}/invite/accept?token=${data.token}`;

    return NextResponse.json(
      {
        invite: {
          id: data.invite_id,
          email: email.toLowerCase().trim(),
          role: inviteRole,
          expires_at: data.expires_at,
        },
        invite_url: inviteUrl,
        rate_limited: data.rate_limited ?? false,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST /api/dashboard/teams/[slug]/invites error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** DELETE — Revoke a pending invite via RPC (editor+ only). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const result = await requireTeamMember(slug, "editor");
    if (!result.ok) return result.error;
    const { team, supabase } = result;

    const { searchParams } = request.nextUrl;
    const inviteId = searchParams.get("id");

    if (!inviteId) {
      return NextResponse.json({ error: "id query parameter is required" }, { status: 400 });
    }

    const { error } = await supabase.rpc("revoke_team_invite", {
      p_invite_id: inviteId,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      const status = msg.includes("not found") ? 404 : msg.includes("only") ? 403 : 500;
      console.error("RPC revoke_team_invite failed:", error.message);
      return NextResponse.json({ error: error.message }, { status });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("DELETE /api/dashboard/teams/[slug]/invites error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
