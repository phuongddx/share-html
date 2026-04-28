/**
 * GET    /api/dashboard/teams/[slug]/invites — List pending invites.
 * POST   /api/dashboard/teams/[slug]/invites — Create a new invite (editor+ only).
 * DELETE /api/dashboard/teams/[slug]/invites — Cancel a pending invite (editor+ only).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeamMember } from "../route";
import { generateInviteToken, getInviteExpiry } from "@/lib/invite-utils";
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
      .select("id, email, role, expires_at, accepted_at, created_at, invited_by")
      .eq("team_id", team.id)
      .is("accepted_at", null)
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

/** POST — Create an invite (editor+ only). */
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

    const normalizedEmail = email.toLowerCase().trim();

    // Check for existing pending invite to same email
    const { data: existingInvite } = await supabase
      .from("team_invites")
      .select("id")
      .eq("team_id", team.id)
      .eq("email", normalizedEmail)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (existingInvite) {
      return NextResponse.json(
        { error: "Pending invite already exists for this email" },
        { status: 409 },
      );
    }

    const token = generateInviteToken();
    const expiresAt = getInviteExpiry();

    const { data: invite, error } = await supabase
      .from("team_invites")
      .insert({
        team_id: team.id,
        email: normalizedEmail,
        role: inviteRole,
        token,
        expires_at: expiresAt,
        invited_by: (await supabase.auth.getUser()).data.user!.id,
      })
      .select("id, email, role, expires_at, created_at")
      .single();

    if (error) {
      console.error("Invite creation failed:", error.message);
      return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
    }

    // Return invite link for copy/paste (email delivery deferred)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://dropitx.com";
    const inviteUrl = `${appUrl}/invite/accept?token=${token}`;

    return NextResponse.json({ invite, invite_url: inviteUrl }, { status: 201 });
  } catch (err) {
    console.error("POST /api/dashboard/teams/[slug]/invites error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** DELETE — Cancel a pending invite (editor+ only). */
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

    const { error } = await supabase
      .from("team_invites")
      .delete()
      .eq("id", inviteId)
      .eq("team_id", team.id)
      .is("accepted_at", null);

    if (error) {
      console.error("Invite cancel failed:", error.message);
      return NextResponse.json({ error: "Failed to cancel invite" }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("DELETE /api/dashboard/teams/[slug]/invites error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
