/**
 * POST /api/v1/documents — Create a document from markdown content.
 * GET  /api/v1/documents — List the authenticated user's documents.
 *
 * All endpoints require API key authentication via Authorization: Bearer shk_...
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/utils/supabase/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { generateSlug, generateDeleteToken } from "@/lib/nanoid";
import { extractTextFromMarkdown } from "@/lib/extract-text";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildShareUrl, getClientIp } from "@/lib/api-utils";

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
    const { content, filename, title, is_private, custom_slug } = body as {
      content?: string; filename?: string; title?: string;
      is_private?: boolean; custom_slug?: string;
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
    });

    if (dbError) {
      console.error("DB insert failed:", dbError.message);
      supabase.storage.from(STORAGE_BUCKET).remove([storagePath]).then(() => {});
      return NextResponse.json({ error: "Failed to save document" }, { status: 500 });
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
