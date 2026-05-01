import { Hono } from "hono";
import { createClientFromJWT } from "@dropitx/shared/supabase/jwt-client";
import type { AppEnv } from "../../app";

const getDetails = new Hono<AppEnv>();

/**
 * GET /invite/details/:token
 * Returns invite details for accept page
 * No authentication required
 */
getDetails.get("/details/:token", async (c) => {
  const token = c.req.param("token");

  // Use anon client to fetch invite details
  const supabase = createClientFromJWT("");

  try {
    const { data: invite, error } = await supabase
      .from("team_invites")
      .select(
        `
        id,
        email,
        role,
        status,
        created_at,
        team:teams(id, slug, name)
        `
      )
      .eq("token", token)
      .single();

    if (error || !invite) {
      return c.json({ error: "Invite not found" }, 404);
    }

    if (invite.status !== "pending") {
      return c.json(
        { error: "Invite has already been " + invite.status },
        400
      );
    }

    return c.json(invite);
  } catch (err) {
    console.error("Unexpected error fetching invite details:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { getDetails };
