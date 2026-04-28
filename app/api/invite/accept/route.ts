/**
 * POST /api/invite/accept — Accept a team invite.
 * Cookie-based auth. Validates token, checks email match (Red Team Fix #9),
 * creates team_members row, marks invite accepted.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { isInviteExpired } from "@/lib/invite-utils";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const authClient = createClient(cookieStore);
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { token } = body as { token?: string };
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Look up the invite
    const { data: invite, error: inviteError } = await supabase
      .from("team_invites")
      .select("id, team_id, email, role, expires_at, accepted_at")
      .eq("token", token)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (invite.accepted_at) {
      return NextResponse.json({ error: "Invite already accepted" }, { status: 410 });
    }

    if (isInviteExpired(invite.expires_at)) {
      return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
    }

    // Red Team Fix #9: Strict email matching — case-insensitive
    const userEmail = (user.email ?? "").toLowerCase().trim();
    const inviteEmail = invite.email.toLowerCase().trim();
    if (userEmail !== inviteEmail) {
      return NextResponse.json(
        { error: `This invite was sent to ${invite.email}. Please log in with that email address.` },
        { status: 403 },
      );
    }

    // Check if already a member (idempotent — return success if already joined)
    const { data: existingMember } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", invite.team_id)
      .eq("user_id", user.id)
      .single();

    if (existingMember) {
      // Already a member — just mark invite as accepted
      await supabase
        .from("team_invites")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", invite.id);

      return NextResponse.json({ ok: true, already_member: true });
    }

    // Create membership and mark invite accepted in a two-step transaction
    // (Supabase JS doesn't support real transactions, but admin client bypasses RLS)
    const { error: memberError } = await supabase
      .from("team_members")
      .insert({
        team_id: invite.team_id,
        user_id: user.id,
        role: invite.role,
        joined_at: new Date().toISOString(),
      });

    if (memberError) {
      // Could be a unique constraint violation if concurrent acceptance
      if (memberError.code === "23505") {
        // Concurrent insert — mark accepted, return success
        await supabase
          .from("team_invites")
          .update({ accepted_at: new Date().toISOString() })
          .eq("id", invite.id);
        return NextResponse.json({ ok: true });
      }
      console.error("Member insert failed:", memberError.message);
      return NextResponse.json({ error: "Failed to join team" }, { status: 500 });
    }

    // Mark invite as accepted
    const { error: updateError } = await supabase
      .from("team_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    if (updateError) {
      console.error("Invite update failed:", updateError.message);
      // Member was created but invite not marked — non-critical, log and proceed
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("POST /api/invite/accept error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
