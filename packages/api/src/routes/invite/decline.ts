/** POST /invite/decline — Decline a team invite via RPC. */

import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import type { AppEnv } from "../../app";

const decline = new Hono<AppEnv>();

decline.post("/", requireAuth, async (c) => {
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

    const { data, error } = await supabase.rpc("decline_team_invite", {
      p_token: token,
      p_user_email: auth.email,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      const status = msg.includes("not found") && !msg.includes("invite not found")
        ? 404
        : msg.includes("invite not found") || msg.includes("revoked")
          ? 410
          : msg.includes("expired")
            ? 410
            : msg.includes("already declined")
              ? 409
              : msg.includes("already accepted")
                ? 409
                : msg.includes("sent to")
                  ? 403
                  : 500;
      return c.json({ error: error.message }, status);
    }

    const row = Array.isArray(data) ? data[0] : data;
    return c.json({ ok: true, team_slug: row?.team_slug });
  } catch (err) {
    console.error("POST /invite/decline error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { decline };
