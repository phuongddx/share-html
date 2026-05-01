/**
 * GET    /api/v1/documents/:slug — Get document metadata + content URL.
 * PATCH  /api/v1/documents/:slug — Update document content.
 * DELETE /api/v1/documents/:slug — Delete document + storage object.
 *
 * All endpoints require API key authentication.
 * Access: owner (user_id match) OR team member via team_shares.
 */

import { Hono } from "hono";
import { createAdminClient } from "@dropitx/shared/supabase/admin";
import { hasMinRole } from "@dropitx/shared/utils/team-utils";
import type { Share } from "@dropitx/shared/types/share";
import type { TeamRole } from "@dropitx/shared/types/team";
import { authenticateApiKey } from "../../lib/api-auth";
import { extractTextFromMarkdown } from "../../lib/extract-text";
import { hashPassword } from "../../lib/password";
import { buildShareUrl } from "../../lib/api-utils";
import type { AppEnv } from "../../app";

const STORAGE_BUCKET = "html-files";
const MAX_CONTENT_SIZE = 1024 * 1024; // 1 MB

type ShareOwnerResult =
  | { ok: false; status: number; body: { error: string } }
  | {
      ok: true;
      share: Share;
      supabase: ReturnType<typeof createAdminClient>;
      /** If accessed via team, the user's role in that team */
      teamRole: string | null;
    };

/**
 * Fetch share row and verify access via API key auth.
 * Access is granted if:
 * - User is the share owner (user_id match), OR
 * - Share belongs to a team the user is a member of (via team_shares + team_members)
 */
async function getOwnedShare(
  authHeader: string | undefined,
  slug: string,
): Promise<ShareOwnerResult> {
  const auth = await authenticateApiKey(authHeader);
  if (!auth) return { ok: false, status: 401, body: { error: "Unauthorized" } };

  const supabase = createAdminClient();
  const { data: share, error } = await supabase
    .from("shares").select("*").eq("slug", slug).single();

  if (error || !share) {
    return { ok: false, status: 404, body: { error: "Document not found" } };
  }
  const typed = share as unknown as Share;

  // Team-scoped keys can only access shares via team_shares, never personal shares
  if (!auth.teamId && typed.user_id === auth.userId) {
    return { ok: true, share: typed, supabase, teamRole: null };
  }

  // Check team access: is this share in a team the user belongs to?
  const { data: teamShare } = await supabase
    .from("team_shares")
    .select("team_id, team_members!inner(role)")
    .eq("share_id", typed.id)
    .eq("team_members.user_id", auth.userId)
    .limit(1);

  interface TeamShareWithMember {
    team_id: string;
    team_members: { role: string } | { role: string }[] | null;
  }

  const teamAccess = teamShare as TeamShareWithMember[] | null;
  if (teamAccess && teamAccess.length > 0) {
    const memberData = teamAccess[0].team_members;
    const role = Array.isArray(memberData) ? memberData[0]?.role : (memberData as { role: string } | null)?.role;
    return { ok: true, share: typed, supabase, teamRole: role ?? "viewer" };
  }

  return { ok: false, status: 403, body: { error: "Forbidden" } };
}

const documentsSlug = new Hono<AppEnv>();

documentsSlug.get("/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    const result = await getOwnedShare(c.req.header("Authorization"), slug);
    if (!result.ok) return c.json(result.body, result.status as 401);
    const { share, supabase } = result;

    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET).getPublicUrl(share.storage_path);

    return c.json({ ...share, content_url: urlData.publicUrl });
  } catch (err) {
    console.error("GET /api/v1/documents/[slug] error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

documentsSlug.patch("/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    const result = await getOwnedShare(c.req.header("Authorization"), slug);
    if (!result.ok) return c.json(result.body, result.status as 401);
    const { share, supabase, teamRole } = result;

    // Team members with viewer role cannot update shares
    if (teamRole && !hasMinRole(teamRole as TeamRole, "editor")) {
      return c.json({ error: "Insufficient permissions" }, 403);
    }

    const body = await c.req.json();
    const { content, filename, title, is_private, password } = body as {
      content?: string; filename?: string; title?: string;
      is_private?: boolean; password?: string | null;
    };

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (filename !== undefined) updates.filename = filename;
    if (title !== undefined) updates.title = title;
    if (is_private !== undefined) updates.is_private = is_private;

    if (password !== undefined) {
      if (password === null || password === "") {
        updates.password_hash = null;
      } else if (typeof password === "string" && password.length >= 4) {
        updates.password_hash = await hashPassword(password);
      }
    }

    if (content !== undefined) {
      if (typeof content !== "string" || content.trim().length === 0) {
        return c.json({ error: "content must be a non-empty string" }, 400);
      }
      if (content.length > MAX_CONTENT_SIZE) {
        return c.json({ error: "content exceeds maximum size of 1MB" }, 400);
      }
      updates.content_text = extractTextFromMarkdown(content);
      updates.file_size = new TextEncoder().encode(content).length;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET).upload(share.storage_path, new TextEncoder().encode(content), {
          contentType: "text/markdown", upsert: true,
        });
      if (uploadError) {
        console.error("Storage update failed:", uploadError.message);
        return c.json({ error: "Failed to update document content" }, 500);
      }
    }

    const { data: updated, error: dbError } = await supabase
      .from("shares").update(updates).eq("id", share.id)
      .select("slug, updated_at").single();

    if (dbError || !updated) {
      console.error("DB update failed:", dbError?.message);
      return c.json({ error: "Failed to update document" }, 500);
    }

    return c.json({
      slug: updated.slug, url: buildShareUrl(c.req.header("host") ?? "", updated.slug),
      updated_at: updated.updated_at,
    });
  } catch (err) {
    console.error("PATCH /api/v1/documents/[slug] error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

documentsSlug.delete("/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    const result = await getOwnedShare(c.req.header("Authorization"), slug);
    if (!result.ok) return c.json(result.body, result.status as 401);
    const { share, supabase, teamRole } = result;

    // Only owners can delete team shares; personal owners can delete their own
    if (teamRole && teamRole !== "owner") {
      return c.json({ error: "Only team owners can delete team shares" }, 403);
    }

    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET).remove([share.storage_path]);
    if (storageError) console.error("Storage delete failed:", storageError.message);

    const { error: dbError } = await supabase.from("shares").delete().eq("id", share.id);
    if (dbError) {
      console.error("DB delete failed:", dbError.message);
      return c.json({ error: "Failed to delete document" }, 500);
    }

    return c.body(null, 204);
  } catch (err) {
    console.error("DELETE /api/v1/documents/[slug] error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { documentsSlug };
