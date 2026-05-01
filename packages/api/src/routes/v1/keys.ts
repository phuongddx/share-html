/**
 * POST /api/v1/keys — Generate a new API key (cookie/JWT auth, NOT API key auth).
 * GET  /api/v1/keys — List the authenticated user's API keys (cookie/JWT auth).
 *
 * Team support: POST accepts optional team_id to create a team-scoped API key.
 */

import { Hono } from "hono";
import { createAdminClient } from "@dropitx/shared/supabase/admin";
import { hasMinRole } from "@dropitx/shared/utils/team-utils";
import type { TeamRole } from "@dropitx/shared/types/team";
import { generateApiKey } from "../../lib/api-key";
import { requireAuth } from "../../middleware/auth";
import type { AppEnv } from "../../app";

const keys = new Hono<AppEnv>();

keys.use("*", requireAuth);

keys.post("/", async (c) => {
  try {
    const userId = c.get("auth").userId;

    const body = await c.req.json();
    const { name, team_id } = body as { name?: string; team_id?: string };

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return c.json({ error: "name is required" }, 400);
    }

    const trimmedName = name.trim().slice(0, 100);
    const supabase = createAdminClient();

    // Determine prefix: team key uses "sht", personal uses "shk"
    let prefix: "shk" | "sht" = "shk";
    let keyTeamId: string | null = null;

    if (team_id) {
      // Validate user is editor+ in the team
      const { data: member } = await supabase
        .from("team_members")
        .select("role")
        .eq("team_id", team_id)
        .eq("user_id", userId)
        .single();

      if (!member || !hasMinRole(member.role as TeamRole, "editor")) {
        return c.json(
          { error: "Insufficient permissions to create team API key" },
          403,
        );
      }

      prefix = "sht";
      keyTeamId = team_id;
    }

    const { key, hash, prefix: keyPrefix } = generateApiKey(prefix);

    const { error } = await supabase.from("api_keys").insert({
      user_id: userId,
      name: trimmedName,
      key_hash: hash,
      key_prefix: keyPrefix,
      team_id: keyTeamId,
    });

    if (error) {
      console.error("API key insert failed:", error.message);
      return c.json({ error: "Failed to create API key" }, 500);
    }

    return c.json(
      {
        key,
        prefix: keyPrefix,
        name: trimmedName,
        team_id: keyTeamId,
        created_at: new Date().toISOString(),
      },
      201,
    );
  } catch (err) {
    console.error("POST /api/v1/keys error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

keys.get("/", async (c) => {
  try {
    const userId = c.get("auth").userId;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("api_keys")
      .select("id, name, key_prefix, team_id, last_used_at, created_at")
      .eq("user_id", userId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("API keys list failed:", error.message);
      return c.json({ error: "Failed to list API keys" }, 500);
    }

    return c.json({ keys: data });
  } catch (err) {
    console.error("GET /api/v1/keys error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { keys };
