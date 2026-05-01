/**
 * GET /dashboard/teams/:slug/events — Paginated team event log.
 * Returns team_events ordered by created_at descending with total count.
 */

import { Hono } from "hono";
import { requireAuth } from "../../../middleware/auth";
import { requireTeamMember } from "../../../lib/require-team-member";
import type { AppEnv } from "../../../app";

const events = new Hono<AppEnv>();

events.get("/:slug/events", requireAuth, requireTeamMember(), async (c) => {
  try {
    const teamMember = c.get("teamMember");
    if (!teamMember) {
      return c.json({ error: "Team membership required" }, 403);
    }

    const { teamId } = teamMember;
    const supabase = c.get("auth").supabaseClient;

    const limit = Math.min(parseInt(c.req.query("limit") ?? "20", 10), 100);
    const offset = parseInt(c.req.query("offset") ?? "0", 10);

    const { data: events, error } = await supabase
      .from("team_events")
      .select("id, event_type, actor_id, target_user_id, metadata, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("List events failed:", error.message);
      return c.json({ error: "Failed to list events" }, 500);
    }

    const { count } = await supabase
      .from("team_events")
      .select("*", { count: "exact", head: true })
      .eq("team_id", teamId);

    return c.json({
      events: events ?? [],
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error("GET /dashboard/teams/:slug/events error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { events };
