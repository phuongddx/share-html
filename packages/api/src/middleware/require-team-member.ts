/**
 * requireTeamMember middleware — verifies the authenticated user is an active
 * member of the team identified by the `:slug` route param.
 *
 * Must be used AFTER `requireAuth` (from ./auth), which sets `c.var.auth`.
 *
 * Optionally accepts a minimum role; if the user's role is lower, a 403 is returned.
 * On success, sets `c.var.teamMember` with `{ teamId, role, slug }`.
 *
 * The lookup uses the admin Supabase client with explicit user_id filtering,
 * since the admin client bypasses RLS.
 */

import { createMiddleware } from "hono/factory";
import { createAdminClient } from "@dropitx/shared/supabase/admin";
import { hasMinRole } from "@dropitx/shared/utils/team-utils";
import type { TeamRole } from "@dropitx/shared/types/team";
import type { AppEnv } from "../app";

/** Team membership context set by requireTeamMember. */
export interface TeamMemberContext {
  teamId: string;
  role: TeamRole;
  slug: string;
}

/** Error response shape. */
interface TeamError {
  error: string;
}

/**
 * Middleware factory: verifies the authenticated user belongs to the team
 * specified by the `:slug` route param and optionally checks minimum role.
 *
 * Usage in route definitions:
 *   app.get("/teams/:slug/members", requireAuth, requireTeamMember(), handler)
 *   app.delete("/teams/:slug", requireAuth, requireTeamMember("owner"), handler)
 */
export function requireTeamMember(minRole?: TeamRole) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const auth = c.get("auth");

    // 1. Must be authenticated
    if (auth.isAnonymous) {
      return c.json<TeamError>({ error: "Unauthorized" }, 401);
    }

    // 2. Slug must exist in route params
    const slug = c.req.param("slug");
    if (!slug) {
      return c.json<TeamError>({ error: "Team slug required" }, 400);
    }

    const supabase = createAdminClient();

    // 3. Look up team by slug
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id, name, slug, created_by, plan, created_at")
      .eq("slug", slug)
      .single();

    if (teamError || !team) {
      return c.json<TeamError>({ error: "Team not found" }, 404);
    }

    // 4. Verify membership — admin client bypasses RLS, so explicit user_id filter is mandatory
    const { data: member, error: memberError } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", team.id)
      .eq("user_id", auth.userId)
      .single();

    if (memberError || !member) {
      return c.json<TeamError>({ error: "Not a team member" }, 403);
    }

    // 5. Enforce minimum role if specified
    if (minRole && !hasMinRole(member.role as TeamRole, minRole)) {
      return c.json<TeamError>({ error: "Insufficient permissions" }, 403);
    }

    // 6. Set teamMember context for downstream handlers
    c.set("teamMember", {
      teamId: team.id,
      role: member.role as TeamRole,
      slug: team.slug,
      team,
    });

    await next();
  });
}
