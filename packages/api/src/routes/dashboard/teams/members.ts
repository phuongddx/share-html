/**
 * GET    /dashboard/teams/:slug/members — List team members with profiles.
 * PATCH  /dashboard/teams/:slug/members — Update member role via RPC (owner only).
 * DELETE /dashboard/teams/:slug/members — Remove member via RPC or leave team.
 */

import { Hono } from "hono";
import { requireAuth } from "../../../middleware/auth";
import { requireTeamMember } from "../../../lib/require-team-member";
import type { AppEnv } from "../../../app";

interface MemberRow {
  team_id: string;
  user_id: string;
  role: string;
  invited_at: string;
  joined_at: string;
  user_profiles?: { display_name: string | null; avatar_url: string | null } | null;
}

const members = new Hono<AppEnv>();

/** GET — List all members with profile information. */
members.get("/:slug/members", requireAuth, requireTeamMember(), async (c) => {
  try {
    const teamMember = c.get("teamMember");
    if (!teamMember) {
      return c.json({ error: "Team membership required" }, 403);
    }

    const { teamId } = teamMember;
    const supabase = c.get("auth").supabaseClient;

    const { data: members, error } = await supabase
      .from("team_members")
      .select("team_id, user_id, role, invited_at, joined_at, user_profiles(display_name, avatar_url)")
      .eq("team_id", teamId)
      .order("joined_at", { ascending: true });

    if (error) {
      console.error("List members failed:", error.message);
      return c.json({ error: "Failed to list members" }, 500);
    }

    return c.json({
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
    console.error("GET /dashboard/teams/:slug/members error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/** PATCH — Update a member's role via RPC (owner only). */
members.patch("/:slug/members", requireAuth, requireTeamMember("owner"), async (c) => {
  try {
    const teamMember = c.get("teamMember");
    if (!teamMember) {
      return c.json({ error: "Team membership required" }, 403);
    }

    const { teamId } = teamMember;
    const supabase = c.get("auth").supabaseClient;

    const body = await c.req.json();
    const { user_id, role } = body as { user_id?: string; role?: string };

    if (!user_id || typeof user_id !== "string") {
      return c.json({ error: "user_id is required" }, 400);
    }
    if (!["owner", "editor", "viewer"].includes(role ?? "")) {
      return c.json({ error: "Invalid role (must be owner, editor, or viewer)" }, 400);
    }

    const { error } = await supabase.rpc("change_member_role", {
      p_team_id: teamId,
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
      return c.json({ error: error.message }, status);
    }

    return c.json({ user_id, role });
  } catch (err) {
    console.error("PATCH /dashboard/teams/:slug/members error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/** DELETE — Remove a member via RPC (owner can remove anyone; non-owners leave). */
members.delete("/:slug/members", requireAuth, requireTeamMember(), async (c) => {
  try {
    const teamMember = c.get("teamMember");
    if (!teamMember) {
      return c.json({ error: "Team membership required" }, 403);
    }

    const { teamId, role: userRole } = teamMember;
    const auth = c.get("auth");
    const supabase = c.get("auth").supabaseClient;

    const targetUserId = c.req.query("user_id");

    if (!targetUserId) {
      return c.json({ error: "user_id query parameter is required" }, 400);
    }

    // Owner can remove anyone; non-owners can only remove themselves (leave)
    if (targetUserId !== auth.userId && userRole !== "owner") {
      return c.json({ error: "Insufficient permissions" }, 403);
    }

    const { error } = await supabase.rpc("remove_team_member", {
      p_team_id: teamId,
      p_user_id: targetUserId,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      const status = msg.includes("not found") ? 404
        : msg.includes("only") ? 403
        : msg.includes("last owner") || msg.includes("cannot") ? 403
        : 500;
      console.error("RPC remove_team_member failed:", error.message);
      return c.json({ error: error.message }, status);
    }

    return c.body(null, 204);
  } catch (err) {
    console.error("DELETE /dashboard/teams/:slug/members error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { members };
