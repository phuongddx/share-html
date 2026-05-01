/**
 * DELETE /api/v1/shares/:slug — Delete a share.
 *
 * Two auth paths via optionalAuth:
 * 1. Authenticated owner: share.user_id === auth.userId
 * 2. Anonymous: valid deleteToken in request body
 */

import { Hono } from "hono";
import { createAdminClient } from "@dropitx/shared/supabase/admin";
import { optionalAuth } from "../../middleware/auth";
import type { AppEnv } from "../../app";

const STORAGE_BUCKET = "html-files";

const app = new Hono<AppEnv>();

app.delete("/:slug", optionalAuth, async (c) => {
  const slug = c.req.param("slug");

  if (!slug || !/^[a-zA-Z0-9_-]{1,20}$/.test(slug)) {
    return c.json({ error: "Invalid slug format." }, 400);
  }

  const adminClient = createAdminClient();

  const { data: share, error: lookupError } = await adminClient
    .from("shares")
    .select("id, storage_path, delete_token, user_id")
    .eq("slug", slug)
    .single();

  if (lookupError || !share) {
    return c.json({ error: "Share not found." }, 404);
  }

  const auth = c.get("auth");
  const isOwner = !auth.isAnonymous && share.user_id === auth.userId;

  if (!isOwner) {
    const body = await c.req.json().catch(() => ({}));
    const { deleteToken } = body as { deleteToken?: string };
    if (!deleteToken || share.delete_token !== deleteToken) {
      return c.json({ error: "Forbidden." }, 403);
    }
  }

  // Delete from storage
  const { error: storageError } = await adminClient.storage
    .from(STORAGE_BUCKET)
    .remove([share.storage_path]);

  if (storageError) {
    console.error("Storage deletion failed:", storageError.message);
  }

  // Delete from database
  const { error: dbError } = await adminClient
    .from("shares")
    .delete()
    .eq("id", share.id);

  if (dbError) {
    console.error("DB deletion failed:", dbError.message);
    return c.json({ error: "Failed to delete share record." }, 500);
  }

  return c.json({ success: true });
});

export default app;
