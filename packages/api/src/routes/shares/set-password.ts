/**
 * POST /api/v1/shares/:slug/set-password — Set, update, or remove a share password.
 *
 * Auth via optionalAuth: session owner (user_id match) OR delete_token in body.
 * Body: { password?: string | null, delete_token?: string }
 */

import { Hono } from "hono";
import { createAdminClient } from "@dropitx/shared/supabase/admin";
import { hashPassword } from "../../lib/password";
import { optionalAuth } from "../../middleware/auth";
import type { Share } from "@dropitx/shared/types/share";
import type { AppEnv } from "../../app";

const MIN_PASSWORD_LENGTH = 4;

const app = new Hono<AppEnv>();

app.post("/:slug/set-password", optionalAuth, async (c) => {
  const slug = c.req.param("slug");

  let body: { password?: unknown; delete_token?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }

  const { password, delete_token } = body;

  const supabase = createAdminClient();
  const { data: share, error } = await supabase
    .from("shares")
    .select("id, user_id, delete_token, password_hash")
    .eq("slug", slug)
    .single<Pick<Share, "id" | "user_id" | "delete_token" | "password_hash">>();

  if (error || !share) {
    return c.json({ error: "Share not found" }, 404);
  }

  // Auth: delete_token first, then session owner
  let authorized = false;

  if (delete_token && typeof delete_token === "string") {
    authorized = delete_token === share.delete_token;
  }

  if (!authorized) {
    const auth = c.get("auth");
    if (!auth.isAnonymous && auth.userId === share.user_id) {
      authorized = true;
    }
  }

  if (!authorized) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  let newHash: string | null = null;

  if (password === null || password === "" || password === undefined) {
    newHash = null;
  } else if (typeof password === "string") {
    if (password.length < MIN_PASSWORD_LENGTH) {
      return c.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        400,
      );
    }
    newHash = await hashPassword(password);
  } else {
    return c.json({ error: "password must be a string or null" }, 400);
  }

  const { error: updateError } = await supabase
    .from("shares")
    .update({ password_hash: newHash, updated_at: new Date().toISOString() })
    .eq("id", share.id);

  if (updateError) {
    console.error("set-password update failed:", updateError.message);
    return c.json({ error: "Failed to update password" }, 500);
  }

  return c.json({ has_password: newHash !== null });
});

export default app;
