/**
 * GET    /dashboard/teams/:slug/invites — List pending invites.
 * POST   /dashboard/teams/:slug/invites — Create a new invite (editor+ only) via RPC.
 * DELETE /dashboard/teams/:slug/invites — Revoke a pending invite (editor+ only) via RPC.
 */

import { Hono } from "hono";
import { requireAuth } from "../../../middleware/auth";
import { requireTeamMember } from "../../../lib/require-team-member";
import type { AppEnv } from "../../../app";
import type { TeamRole } from "@dropitx/shared/types/team";

const invites = new Hono<AppEnv>();

/** GET — List invites for this team (all members can view). */
invites.get("/:slug/invites", requireAuth, requireTeamMember(), async (c) => {
  try {
    const teamMember = c.get("teamMember");
    if (!teamMember) {
      return c.json({ error: "Team membership required" }, 403);
    }

    const { teamId } = teamMember;
    const supabase = c.get("auth").supabaseClient;

    const { data: invites, error } = await supabase
      .from("team_invites")
      .select("id, email, role, status, expires_at, created_at, invited_by")
      .eq("team_id", teamId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("List invites failed:", error.message);
      return c.json({ error: "Failed to list invites" }, 500);
    }

    return c.json({ invites: invites ?? [] });
  } catch (err) {
    console.error("GET /dashboard/teams/:slug/invites error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/** POST — Create an invite via RPC (editor+ only). */
invites.post("/:slug/invites", requireAuth, requireTeamMember("editor"), async (c) => {
  try {
    const teamMember = c.get("teamMember");
    if (!teamMember) {
      return c.json({ error: "Team membership required" }, 403);
    }

    const { teamId, role: userRole } = teamMember;
    const supabase = c.get("auth").supabaseClient;

    const body = await c.req.json();
    const { email, role } = body as { email?: string; role?: string };

    // Validate email
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return c.json({ error: "Invalid email address" }, 400);
    }

    // Validate role
    const inviteRole: TeamRole = (["owner", "editor", "viewer"].includes(role ?? "") ? role : "viewer") as TeamRole;
    // Only owners can invite as owner
    if (inviteRole === "owner" && userRole !== "owner") {
      return c.json({ error: "Only owners can invite new owners" }, 403);
    }

    const { data, error } = await supabase.rpc("create_team_invite", {
      p_team_id: teamId,
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
      return c.json({ error: error.message }, status);
    }

    // Build the invite URL from the token returned by RPC
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://dropitx.com";
    const inviteUrl = `${appUrl}/invite/accept?token=${data.token}`;

    return c.json(
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
      201,
    );
  } catch (err) {
    console.error("POST /dashboard/teams/:slug/invites error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/** DELETE — Revoke a pending invite via RPC (editor+ only). */
invites.delete("/:slug/invites", requireAuth, requireTeamMember("editor"), async (c) => {
  try {
    const teamMember = c.get("teamMember");
    if (!teamMember) {
      return c.json({ error: "Team membership required" }, 403);
    }

    const supabase = c.get("auth").supabaseClient;

    const inviteId = c.req.query("id");

    if (!inviteId) {
      return c.json({ error: "id query parameter is required" }, 400);
    }

    const { error } = await supabase.rpc("revoke_team_invite", {
      p_invite_id: inviteId,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      const status = msg.includes("not found") ? 404 : msg.includes("only") ? 403 : 500;
      console.error("RPC revoke_team_invite failed:", error.message);
      return c.json({ error: error.message }, status);
    }

    return c.body(null, 204);
  } catch (err) {
    console.error("DELETE /dashboard/teams/:slug/invites error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { invites };
