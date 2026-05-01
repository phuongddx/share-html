/**
 * DELETE /api/v1/keys/:id — Revoke an API key (cookie/JWT auth).
 * Sets revoked_at to NOW() rather than deleting the row for audit purposes.
 */

import { Hono } from "hono";
import { createAdminClient } from "@dropitx/shared/supabase/admin";
import { requireAuth } from "../../middleware/auth";
import type { AppEnv } from "../../app";

const keysId = new Hono<AppEnv>();

keysId.use("*", requireAuth);

keysId.delete("/:id", async (c) => {
  try {
    const userId = c.get("auth").userId;
    const id = c.req.param("id");

    const supabase = createAdminClient();

    // Verify ownership before revoking
    const { data: key, error: fetchError } = await supabase
      .from("api_keys")
      .select("user_id")
      .eq("id", id)
      .is("revoked_at", null)
      .single();

    if (fetchError || !key) {
      return c.json({ error: "API key not found" }, 404);
    }

    if (key.user_id !== userId) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const { error } = await supabase
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("Key revocation failed:", error.message);
      return c.json({ error: "Failed to revoke API key" }, 500);
    }

    return c.body(null, 204);
  } catch (err) {
    console.error("DELETE /api/v1/keys/[id] error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { keysId };
