/**
 * POST /invite/accept — Accept a team invite via RPC.
 * Cookie-based auth. RPC handles email match, membership creation, and invite acceptance.
 */

import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import type { AppEnv } from "../../app";

const accept = new Hono<AppEnv>();

accept.post("/", requireAuth, async (c) => {
  try {
    const auth = c.get("auth");
    const supabase = c.get("auth").supabaseClient;

    if (!auth.email) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json();
    const { token } = body as { token?: string };

    if (!token || typeof token !== "string") {
      return c.json({ error: "Token is required" }, 400);
    }

    const { data, error } = await supabase.rpc("accept_team_invite", {
      p_token: token,
      p_user_email: auth.email,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      const status = msg.includes("not found")
        ? 404
        : msg.includes("already accepted")
          ? 409
          : msg.includes("expired")
            ? 410
            : msg.includes("revoked")
              ? 410
              : msg.includes("sent to")
                ? 403
                : msg.includes("no longer valid")
                  ? 410
                  : 500;
      return c.json({ error: error.message }, status);
    }

    return c.json({
      ok: true,
      team_slug: data.team_slug,
      already_member: data.already_member,
    });
  } catch (err) {
    console.error("POST /invite/accept error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { accept };
