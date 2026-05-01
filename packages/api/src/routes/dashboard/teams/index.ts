/**
 * GET  /dashboard/teams — List the authenticated user's teams.
 * POST /dashboard/teams — Create a new team.
 */

import { Hono } from "hono";
import { createAdminClient } from "@dropitx/shared/supabase/admin";
import { generateTeamSlug, isValidTeamName, isValidTeamSlug } from "@dropitx/shared/utils/team-utils";
import { requireAuth } from "../../../middleware/auth";
import type { AppEnv } from "../../../app";

const teams = new Hono<AppEnv>();

/** GET — List user's teams with their role in each. */
teams.get("/", requireAuth, async (c) => {
  try {
    const auth = c.get("auth");
    const supabase = auth.supabaseClient;

    const { data: memberships, error } = await supabase
      .from("team_members")
      .select("role, teams(id, name, slug, plan, created_at, created_by)")
      .eq("user_id", auth.userId);

    if (error) {
      console.error("GET /dashboard/teams error:", error.message);
      return c.json({ error: "Failed to list teams" }, 500);
    }

    interface TeamRow {
      id: string; name: string; slug: string;
      plan: string; created_at: string; created_by: string;
    }
    interface MembershipRow { role: string; teams: TeamRow }

    return c.json({
      teams: (memberships as unknown as MembershipRow[] | null)?.map((m) => ({
        ...m.teams,
        role: m.role,
      })) ?? [],
    });
  } catch (err) {
    console.error("GET /dashboard/teams error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/** POST — Create a new team. Creator becomes owner via DB trigger. */
teams.post("/", requireAuth, async (c) => {
  try {
    const auth = c.get("auth");

    const body = await c.req.json();
    const { name, slug } = body as { name?: string; slug?: string };

    if (!name || !isValidTeamName(name)) {
      return c.json({ error: "Invalid team name (1-100 chars, no control chars)" }, 400);
    }

    const teamSlug = slug ?? generateTeamSlug(name);
    if (!isValidTeamSlug(teamSlug)) {
      return c.json({ error: "Invalid team slug (2-50 chars, lowercase alphanumeric + hyphens)" }, 400);
    }

    // Use admin client (bypasses RLS) for server-side writes
    const admin = createAdminClient();
    const { data: team, error } = await admin
      .from("teams")
      .insert({ name, slug: teamSlug, created_by: auth.userId })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return c.json({ error: "Team slug already taken" }, 409);
      }
      console.error("Team creation failed:", error.message);
      return c.json({ error: "Failed to create team" }, 500);
    }

    // Owner membership is auto-created by the add_team_owner DB trigger
    return c.json({ team, role: "owner" }, 201);
  } catch (err) {
    console.error("POST /dashboard/teams error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { teams };
