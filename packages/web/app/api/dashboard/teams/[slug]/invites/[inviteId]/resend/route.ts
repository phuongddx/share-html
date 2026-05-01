/**
 * POST /api/dashboard/teams/[slug]/invites/[inviteId]/resend — Resend a pending invite.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeamMember } from "../../../route";
import { generateInviteToken, getInviteExpiry } from "@/lib/invite-utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; inviteId: string }> }
) {
  try {
    const { slug, inviteId } = await params;
    const result = await requireTeamMember(slug, "editor");
    if (!result.ok) return result.error;
    const { team, supabase } = result;

    // Get the existing invite
    const { data: existingInvite, error: fetchError } = await supabase
      .from("team_invites")
      .select("id, email, role, expires_at, accepted_at, token")
      .eq("id", inviteId)
      .eq("team_id", team.id)
      .single();

    if (fetchError || !existingInvite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    // Check if invite is still pending and not expired
    const now = new Date();
    const isExpired = new Date(existingInvite.expires_at) < now;
    const isAccepted = existingInvite.accepted_at !== null;

    if (isAccepted) {
      return NextResponse.json({ error: "Invite has already been accepted" }, { status: 400 });
    }

    if (isExpired) {
      // Generate new token and expiry for expired invites
      const newToken = generateInviteToken();
      const newExpiresAt = getInviteExpiry();

      const { data: updatedInvite, error: updateError } = await supabase
        .from("team_invites")
        .update({
          token: newToken,
          expires_at: newExpiresAt,
        })
        .eq("id", inviteId)
        .select("id, email, role, expires_at")
        .single();

      if (updateError) {
        console.error("Failed to resend expired invite:", updateError.message);
        return NextResponse.json({ error: "Failed to resend invite" }, { status: 500 });
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://dropitx.com";
      const inviteUrl = `${appUrl}/invite/accept?token=${newToken}`;

      return NextResponse.json({
        invite: updatedInvite,
        invite_url: inviteUrl,
        message: "Invite resent with new token and extended expiry"
      });
    } else {
      // For pending non-expired invites, just return existing URL
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://dropitx.com";
      const inviteUrl = `${appUrl}/invite/accept?token=${existingInvite.token}`;

      return NextResponse.json({
        invite: existingInvite,
        invite_url: inviteUrl,
        message: "Invite resent"
      });
    }
  } catch (err) {
    console.error("POST /api/dashboard/teams/[slug]/invites/[inviteId]/resend error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}