/**
 * GET    /api/v1/documents/[slug] — Get document metadata + content URL.
 * PATCH  /api/v1/documents/[slug] — Update document content.
 * DELETE /api/v1/documents/[slug] — Delete document + storage object.
 *
 * All endpoints require API key authentication.
 * Access: owner (user_id match) OR team member via team_shares.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { extractTextFromMarkdown } from "@/lib/extract-text";
import { hashPassword } from "@/lib/password";
import { buildShareUrl } from "@/lib/api-utils";
import { hasMinRole } from "@/lib/team-utils";
import type { Share } from "@/types/share";
import type { TeamRole } from "@/types/team";

const STORAGE_BUCKET = "html-files";
const MAX_CONTENT_SIZE = 1024 * 1024; // 1 MB

type ShareOwnerResult =
  | { ok: false; error: NextResponse }
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
  request: NextRequest,
  slug: string,
): Promise<ShareOwnerResult> {
  const auth = await authenticateApiKey(request);
  if (!auth) return { ok: false, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const supabase = createAdminClient();
  const { data: share, error } = await supabase
    .from("shares").select("*").eq("slug", slug).single();

  if (error || !share) {
    return { ok: false, error: NextResponse.json({ error: "Document not found" }, { status: 404 }) };
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

  // The join returns team_members as an array — extract the role
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

  return { ok: false, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const result = await getOwnedShare(request, slug);
    if (!result.ok) return result.error;
    const { share, supabase } = result;

    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET).getPublicUrl(share.storage_path);

    return NextResponse.json({ ...share, content_url: urlData.publicUrl });
  } catch (err) {
    console.error("GET /api/v1/documents/[slug] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const result = await getOwnedShare(request, slug);
    if (!result.ok) return result.error;
    const { share, supabase, teamRole } = result;

    // Team members with viewer role cannot update shares
    if (teamRole && !hasMinRole(teamRole as TeamRole, "editor")) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
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
        return NextResponse.json({ error: "content must be a non-empty string" }, { status: 400 });
      }
      if (content.length > MAX_CONTENT_SIZE) {
        return NextResponse.json({ error: "content exceeds maximum size of 1MB" }, { status: 400 });
      }
      updates.content_text = extractTextFromMarkdown(content);
      updates.file_size = new TextEncoder().encode(content).length;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET).upload(share.storage_path, new TextEncoder().encode(content), {
          contentType: "text/markdown", upsert: true,
        });
      if (uploadError) {
        console.error("Storage update failed:", uploadError.message);
        return NextResponse.json({ error: "Failed to update document content" }, { status: 500 });
      }
    }

    const { data: updated, error: dbError } = await supabase
      .from("shares").update(updates).eq("id", share.id)
      .select("slug, updated_at").single();

    if (dbError || !updated) {
      console.error("DB update failed:", dbError?.message);
      return NextResponse.json({ error: "Failed to update document" }, { status: 500 });
    }

    return NextResponse.json({
      slug: updated.slug, url: buildShareUrl(request, updated.slug),
      updated_at: updated.updated_at,
    });
  } catch (err) {
    console.error("PATCH /api/v1/documents/[slug] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const result = await getOwnedShare(request, slug);
    if (!result.ok) return result.error;
    const { share, supabase, teamRole } = result;

    // Only owners can delete team shares; personal owners can delete their own
    if (teamRole && teamRole !== "owner") {
      return NextResponse.json({ error: "Only team owners can delete team shares" }, { status: 403 });
    }

    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET).remove([share.storage_path]);
    if (storageError) console.error("Storage delete failed:", storageError.message);

    const { error: dbError } = await supabase.from("shares").delete().eq("id", share.id);
    if (dbError) {
      console.error("DB delete failed:", dbError.message);
      return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("DELETE /api/v1/documents/[slug] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
