/**
 * POST /api/v1/documents — Create a document from markdown content.
 * GET  /api/v1/documents — List the authenticated user's documents.
 *
 * Team support: POST accepts optional X-Team-Id header to share to a team.
 * GET returns team-scoped shares when using a team API key.
 * All endpoints require API key authentication via Authorization: Bearer shk_... or sht_...
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/utils/supabase/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { generateSlug, generateDeleteToken } from "@/lib/nanoid";
import { extractTextFromMarkdown } from "@/lib/extract-text";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashPassword } from "@/lib/password";
import { buildShareUrl, getClientIp } from "@/lib/api-utils";
import { hasMinRole } from "@/lib/team-utils";
import type { TeamRole } from "@/types/team";

const MAX_CONTENT_SIZE = 1024 * 1024; // 1 MB
const STORAGE_BUCKET = "html-files";

/** Extract the first H1 heading from markdown, or null. */
function extractTitleFromH1(md: string): string | null {
  const match = md.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiKey(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const ip = getClientIp(request);
    const rateResult = await checkRateLimit(ip);
    if (!rateResult.success) {
      return NextResponse.json({ error: "Rate limit exceeded" }, {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(rateResult.limit),
          "X-RateLimit-Remaining": String(rateResult.remaining),
          "X-RateLimit-Reset": String(rateResult.reset),
        },
      });
    }

    const body = await request.json();
    const { content, filename, title, is_private, custom_slug, password } = body as {
      content?: string; filename?: string; title?: string;
      is_private?: boolean; custom_slug?: string; password?: string;
    };

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json(
        { error: "content is required and must be a non-empty string" },
        { status: 400 },
      );
    }
    if (content.length > MAX_CONTENT_SIZE) {
      return NextResponse.json({ error: "content exceeds maximum size of 1MB" }, { status: 400 });
    }

    const resolvedTitle = title || extractTitleFromH1(content) || null;
    const slug = generateSlug();
    const deleteToken = generateDeleteToken();
    const storagePath = `${randomUUID()}.md`;
    const resolvedFilename = filename || "document.md";
    const contentText = extractTextFromMarkdown(content);

    let passwordHash: string | null = null;
    if (password && typeof password === "string" && password.length >= 4) {
      passwordHash = await hashPassword(password);
    }

    const supabase = createAdminClient();
    const fileBody = new TextEncoder().encode(content);

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBody, { contentType: "text/markdown", upsert: false });

    if (uploadError) {
      console.error("Storage upload failed:", uploadError.message);
      return NextResponse.json({ error: "Failed to upload document" }, { status: 500 });
    }

    const { error: dbError } = await supabase.from("shares").insert({
      slug, filename: resolvedFilename, storage_path: storagePath,
      content_text: contentText, file_size: fileBody.length,
      mime_type: "text/markdown", delete_token: deleteToken,
      user_id: auth.userId, title: resolvedTitle,
      custom_slug: custom_slug || null, source: "editor",
      is_private: is_private ?? false,
      password_hash: passwordHash,
    });

    if (dbError) {
      console.error("DB insert failed:", dbError.message);
      supabase.storage.from(STORAGE_BUCKET).remove([storagePath]).then(() => {});
      return NextResponse.json({ error: "Failed to save document" }, { status: 500 });
    }

    // Team support: if X-Team-Id header provided, validate membership and create team_shares row
    const teamId = request.headers.get("X-Team-Id");
    if (teamId) {
      const { data: member } = await supabase
        .from("team_members")
        .select("role")
        .eq("team_id", teamId)
        .eq("user_id", auth.userId)
        .single();

      if (!member || !hasMinRole(member.role as TeamRole, "editor")) {
        // Share was created but not added to team — clean up the share
        // Actually, keep the share (personal), just don't add to team
        return NextResponse.json({
          slug, url: buildShareUrl(request, slug),
          title: resolvedTitle, filename: resolvedFilename,
          warning: "Share created but not added to team: insufficient permissions",
        }, { status: 201 });
      }

      // Get the share ID we just inserted
      const { data: shareRow } = await supabase
        .from("shares").select("id").eq("slug", slug).single();

      if (shareRow) {
        await supabase.from("team_shares").insert({
          share_id: shareRow.id,
          team_id: teamId,
          shared_by: auth.userId,
        });
      }
    }

    return NextResponse.json({
      slug, url: buildShareUrl(request, slug),
      title: resolvedTitle, filename: resolvedFilename,
    }, { status: 201 });
  } catch (err) {
    console.error("POST /api/v1/documents error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiKey(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "20", 10) || 20));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0);

    const supabase = createAdminClient();

    // Team-scoped query: when using a team API key, list team shares
    if (auth.teamId) {
      const { count, error: countError } = await supabase
        .from("team_shares")
        .select("*", { count: "exact", head: true })
        .eq("team_id", auth.teamId);

      if (countError) {
        console.error("Team shares count failed:", countError.message);
        return NextResponse.json({ error: "Failed to count documents" }, { status: 500 });
      }

      const { data, error } = await supabase
        .from("team_shares")
        .select("share_id, created_at, shares(id, slug, filename, title, custom_slug, source, is_private, mime_type, file_size, created_at, updated_at, expires_at, view_count)")
        .eq("team_id", auth.teamId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error("Team shares list failed:", error.message);
        return NextResponse.json({ error: "Failed to list documents" }, { status: 500 });
      }

      // Flatten: extract share fields from the join
      const documents = (data ?? []).map((row: Record<string, unknown>) => {
        const share = row.shares as Record<string, unknown>;
        return {
          id: share.id, slug: share.slug, filename: share.filename,
          title: share.title, custom_slug: share.custom_slug,
          source: share.source, is_private: share.is_private,
          mime_type: share.mime_type, file_size: share.file_size,
          created_at: share.created_at, updated_at: share.updated_at,
          expires_at: share.expires_at, view_count: share.view_count,
        };
      });

      return NextResponse.json({ documents, total: count ?? 0 });
    }

    // Personal query (unchanged from original behavior)
    const { count, error: countError } = await supabase
      .from("shares").select("*", { count: "exact", head: true })
      .eq("user_id", auth.userId);

    if (countError) {
      console.error("Count query failed:", countError.message);
      return NextResponse.json({ error: "Failed to count documents" }, { status: 500 });
    }

    const { data, error } = await supabase
      .from("shares")
      .select("id, slug, filename, title, custom_slug, source, is_private, mime_type, file_size, created_at, updated_at, expires_at, view_count")
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("List query failed:", error.message);
      return NextResponse.json({ error: "Failed to list documents" }, { status: 500 });
    }

    return NextResponse.json({ documents: data, total: count ?? 0 });
  } catch (err) {
    console.error("GET /api/v1/documents error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
