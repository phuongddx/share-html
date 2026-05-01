/**
 * POST /dashboard/teams/:slug/invites/bulk — Create multiple invites at once.
 */

import { Hono } from "hono";
import { requireAuth } from "../../../middleware/auth";
import { requireTeamMember } from "../../../lib/require-team-member";
import { generateInviteToken, getInviteExpiry } from "../../../lib/invite-utils";
import type { AppEnv } from "../../../app";
import type { TeamRole } from "@dropitx/shared/types/team";

const bulkInvites = new Hono<AppEnv>();

bulkInvites.post("/:slug/invites/bulk", requireAuth, requireTeamMember("editor"), async (c) => {
  try {
    const teamMember = c.get("teamMember");
    if (!teamMember) {
      return c.json({ error: "Team membership required" }, 403);
    }

    const { teamId, role: userRole } = teamMember;
    const auth = c.get("auth");
    const supabase = c.get("auth").supabaseClient;

    const body = await c.req.json();
    const { emails, role }: { emails?: string[]; role?: TeamRole } = body;

    // Validate input
    if (!Array.isArray(emails) || emails.length === 0) {
      return c.json({ error: "Emails array is required" }, 400);
    }

    if (emails.length > 50) {
      return c.json({ error: "Maximum 50 emails allowed per bulk request" }, 400);
    }

    // Validate role
    const inviteRole: TeamRole = (role && ["owner", "editor", "viewer"].includes(role)) ? role : "viewer";

    // Only owners can invite as owner
    if (inviteRole === "owner" && userRole !== "owner") {
      return c.json({ error: "Only owners can invite new owners" }, 403);
    }

    // Validate emails
    const validEmails: string[] = [];
    const invalidEmails: string[] = [];

    emails.forEach(email => {
      const trimmed = email.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (trimmed && emailRegex.test(trimmed)) {
        validEmails.push(trimmed.toLowerCase());
      } else {
        invalidEmails.push(trimmed);
      }
    });

    if (validEmails.length === 0) {
      return c.json({
        error: "No valid email addresses provided",
        invalid_emails: invalidEmails
      }, 400);
    }

    // Check for existing pending invites
    const existingEmails = new Set<string>();
    if (validEmails.length > 0) {
      const { data: existingInvites } = await supabase
        .from("team_invites")
        .select("email")
        .in("email", validEmails)
        .eq("team_id", teamId)
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString());

      existingInvites?.forEach((invite: { email: string }) => {
        existingEmails.add(invite.email);
      });
    }

    const invitesToCreate = validEmails.filter(email => !existingEmails.has(email));
    const duplicateEmails = validEmails.filter(email => existingEmails.has(email));

    // Create invites
    const createdInvites = [];
    const errors = [];

    for (const email of invitesToCreate) {
      const token = generateInviteToken();
      const expiresAt = getInviteExpiry();

      const { data: invite, error } = await supabase
        .from("team_invites")
        .insert({
          team_id: teamId,
          email,
          role: inviteRole,
          token,
          expires_at: expiresAt,
          invited_by: auth.userId,
        })
        .select("id, email, role, token, expires_at, created_at")
        .single();

      if (error) {
        console.error(`Failed to create invite for ${email}:`, error.message);
        errors.push({ email, error: error.message });
      } else {
        createdInvites.push(invite);
      }
    }

    // Generate invite URLs
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://dropitx.com";
    const invitesWithUrls = createdInvites.map(invite => ({
      ...invite,
      invite_url: `${appUrl}/invite/accept?token=${invite.token}`
    }));

    return c.json({
      success: true,
      created_count: invitesWithUrls.length,
      duplicate_count: duplicateEmails.length,
      error_count: errors.length,
      invites: invitesWithUrls,
      duplicates: duplicateEmails,
      errors: errors,
      summary: {
        total_attempted: validEmails.length,
        successful: invitesWithUrls.length,
        duplicates: duplicateEmails.length,
        failed: errors.length
      }
    }, 201);

  } catch (err) {
    console.error("POST /dashboard/teams/:slug/invites/bulk error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { bulkInvites };
