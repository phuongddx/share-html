/**
 * Hono middleware to verify team membership and role.
 * Replaces the cookie-based requireTeamMember function from Next.js routes.
 *
 * IMPORTANT: Uses admin client with explicit userId filtering.
 * Admin client bypasses RLS, so we must manually scope queries by userId.
 */

import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../app";
import { createAdminClient } from "@dropitx/shared/supabase/admin";
import type { TeamRole } from "@dropitx/shared/types/team";

interface TeamRow {
  id: string;
  name: string;
  slug: string;
  created_by: string;
  plan: string;
  created_at: string;
}

interface TeamMemberContext {
  teamId: string;
  role: TeamRole;
  slug: string;
  team: TeamRow;
}

/**
 * Require authenticated user to be a member of the team specified by :slug param.
 * Optionally enforce minimum role level.
 *
 * @param minRole - Minimum role required (viewer | editor | owner)
 * @returns Hono middleware that sets c.get('teamMember')
 */
export function requireTeamMember(minRole?: TeamRole): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const auth = c.get("auth");

    // Reject anonymous users
    if (auth.isAnonymous) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const slug = c.req.param("slug");
    if (!slug) {
      return c.json({ error: "Team slug required" }, 400);
    }

    const adminClient = createAdminClient();

    // Fetch team by slug (admin client bypasses RLS)
    const { data: team, error: teamError } = await adminClient
      .from("teams")
      .select("*")
      .eq("slug", slug)
      .single<TeamRow>();

    if (teamError || !team) {
      return c.json({ error: "Team not found" }, 404);
    }

    // Fetch membership with explicit userId filter (admin client bypasses RLS)
    const { data: member, error: memberError } = await adminClient
      .from("team_members")
      .select("role")
      .eq("team_id", team.id)
      .eq("user_id", auth.userId)
      .single<{ role: TeamRole }>();

    if (memberError || !member) {
      return c.json({ error: "Not a team member" }, 403);
    }

    // Check role level if minRole specified
    if (minRole) {
      const levels: Record<TeamRole, number> = {
        viewer: 1,
        editor: 2,
        owner: 3,
      };

      const userLevel = levels[member.role as TeamRole] ?? 0;
      const requiredLevel = levels[minRole] ?? 0;

      if (userLevel < requiredLevel) {
        return c.json({ error: "Insufficient permissions" }, 403);
      }
    }

    // Set team context for downstream handlers
    c.set("teamMember", {
      teamId: team.id,
      role: member.role,
      slug: team.slug,
      team: {
        id: team.id,
        name: team.name,
        slug: team.slug,
        created_by: team.created_by,
        plan: team.plan,
        created_at: team.created_at,
      },
    });

    await next();
  };
}
