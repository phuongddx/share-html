/**
 * POST /dashboard/teams/:slug/invites/:inviteId/resend — Resend a pending invite.
 */

import { Hono } from "hono";
import { requireAuth } from "../../../middleware/auth";
import { requireTeamMember } from "../../../lib/require-team-member";
import { generateInviteToken, getInviteExpiry } from "../../../lib/invite-utils";
import type { AppEnv } from "../../../app";

const resend = new Hono<AppEnv>();

resend.post("/:slug/invites/:inviteId/resend", requireAuth, requireTeamMember("editor"), async (c) => {
  try {
    const teamMember = c.get("teamMember");
    if (!teamMember) {
      return c.json({ error: "Team membership required" }, 403);
    }

    const { teamId } = teamMember;
    const supabase = c.get("auth").supabaseClient;
    const inviteId = c.req.param("inviteId");

    // Get the existing invite
    const { data: existingInvite, error: fetchError } = await supabase
      .from("team_invites")
      .select("id, email, role, expires_at, accepted_at, token")
      .eq("id", inviteId)
      .eq("team_id", teamId)
      .single();

    if (fetchError || !existingInvite) {
      return c.json({ error: "Invite not found" }, 404);
    }

    // Check if invite is still pending and not expired
    const now = new Date();
    const isExpired = new Date(existingInvite.expires_at) < now;
    const isAccepted = existingInvite.accepted_at !== null;

    if (isAccepted) {
      return c.json({ error: "Invite has already been accepted" }, 400);
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
        return c.json({ error: "Failed to resend invite" }, 500);
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://dropitx.com";
      const inviteUrl = `${appUrl}/invite/accept?token=${newToken}`;

      return c.json({
        invite: updatedInvite,
        invite_url: inviteUrl,
        message: "Invite resent with new token and extended expiry"
      });
    } else {
      // For pending non-expired invites, just return existing URL
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://dropitx.com";
      const inviteUrl = `${appUrl}/invite/accept?token=${existingInvite.token}`;

      return c.json({
        invite: existingInvite,
        invite_url: inviteUrl,
        message: "Invite resent"
      });
    }
  } catch (err) {
    console.error("POST /dashboard/teams/:slug/invites/:inviteId/resend error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { resend };
