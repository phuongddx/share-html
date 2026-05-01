/**
 * GET    /dashboard/teams/:slug — Get team details + member count.
 * PATCH  /dashboard/teams/:slug — Update team name/slug (owner only).
 * DELETE /dashboard/teams/:slug — Delete team (owner only).
 */

import { Hono } from "hono";
import { isValidTeamName, isValidTeamSlug } from "@dropitx/shared/utils/team-utils";
import { requireAuth } from "../../../middleware/auth";
import { requireTeamMember } from "../../../lib/require-team-member";
import type { AppEnv } from "../../../app";

const slug = new Hono<AppEnv>();

/** GET — Team details with member count. */
slug.get("/:slug", requireAuth, requireTeamMember(), async (c) => {
  try {
    const teamMember = c.get("teamMember");
    if (!teamMember) {
      return c.json({ error: "Team membership required" }, 403);
    }
    const { teamId } = teamMember;
    const supabase = c.get("auth").supabaseClient;

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("*")
      .eq("id", teamId)
      .single();

    if (teamError || !team) {
      return c.json({ error: "Team not found" }, 404);
    }

    const { count } = await supabase
      .from("team_members")
      .select("*", { count: "exact", head: true })
      .eq("team_id", teamId);

    return c.json({ ...team, member_count: count ?? 0 });
  } catch (err) {
    console.error("GET /dashboard/teams/:slug error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/** PATCH — Update team name/slug (owner only). */
slug.patch("/:slug", requireAuth, requireTeamMember("owner"), async (c) => {
  try {
    const teamMember = c.get("teamMember");
    if (!teamMember) {
      return c.json({ error: "Team membership required" }, 403);
    }
    const { teamId } = teamMember;
    const supabase = c.get("auth").supabaseClient;

    const body = await c.req.json();
    const { name, slug: newSlug } = body as { name?: string; slug?: string };

    const updates: Record<string, string> = {};
    if (name !== undefined) {
      if (!isValidTeamName(name)) {
        return c.json({ error: "Invalid team name" }, 400);
      }
      updates.name = name;
    }
    if (newSlug !== undefined) {
      if (!isValidTeamSlug(newSlug)) {
        return c.json({ error: "Invalid team slug" }, 400);
      }
      // Check slug doesn't conflict with another team
      const { data: existing } = await supabase
        .from("teams").select("id").eq("slug", newSlug).neq("id", teamId).single();
      if (existing) {
        return c.json({ error: "Slug already taken" }, 409);
      }
      updates.slug = newSlug;
    }

    if (Object.keys(updates).length === 0) {
      return c.json({ error: "No valid fields to update" }, 400);
    }

    const { data: updated, error } = await supabase
      .from("teams").update(updates).eq("id", teamId).select().single();

    if (error) {
      if (error.code === "23505") {
        return c.json({ error: "Slug already taken" }, 409);
      }
      console.error("Team update failed:", error.message);
      return c.json({ error: "Failed to update team" }, 500);
    }

    return c.json(updated);
  } catch (err) {
    console.error("PATCH /dashboard/teams/:slug error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/** DELETE — Delete team (owner only). Cascades remove members, invites, team_shares. */
slug.delete("/:slug", requireAuth, requireTeamMember("owner"), async (c) => {
  try {
    const teamMember = c.get("teamMember");
    if (!teamMember) {
      return c.json({ error: "Team membership required" }, 403);
    }
    const { teamId } = teamMember;
    const supabase = c.get("auth").supabaseClient;

    const { error } = await supabase
      .from("teams").delete().eq("id", teamId);
    if (error) {
      console.error("Team delete failed:", error.message);
      return c.json({ error: "Failed to delete team" }, 500);
    }

    return c.body(null, 204);
  } catch (err) {
    console.error("DELETE /dashboard/teams/:slug error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { slug };
