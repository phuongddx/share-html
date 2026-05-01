/**
 * POST /api/publish — Publish markdown content from the editor.
 * Auth required. Content stored identically to file uploads.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@dropitx/shared/supabase/admin";
import { generateSlug, generateDeleteToken } from "@/lib/nanoid";
import { extractTextFromMarkdown } from "@/lib/extract-text";
import { validateEditorContent } from "@dropitx/shared/validation/editor-content";
import { extractTitleFromMarkdown } from "@/lib/extract-title-from-markdown";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 30;

const STORAGE_BUCKET = "html-files";

function getClientIp(request: NextRequest): string {
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const entries = forwarded.split(",").map((s) => s.trim());
    return entries[entries.length - 1];
  }
  return "unknown";
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const ip = getClientIp(request);
    const rateResult = await checkRateLimit(ip);
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 },
      );
    }

    // Auth check
    const cookieStore = await cookies();
    const authClient = createClient(cookieStore);
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    // Parse body
    const body = await request.json();
    const { content, filename, title, is_private, custom_slug } = body as {
      content?: string;
      filename?: string;
      title?: string;
      is_private?: boolean;
      custom_slug?: string;
    };

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Content is required." }, { status: 400 });
    }

    // Validate content
    const validation = validateEditorContent(content);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const resolvedFilename = (filename || "untitled.md").replace(/\.+$/, "") + ".md";
    const resolvedTitle = extractTitleFromMarkdown(content, resolvedFilename);
    const contentText = extractTextFromMarkdown(content);

    // Generate identifiers
    const slug = generateSlug();
    const deleteToken = generateDeleteToken();
    const storageUuid = randomUUID();
    const storagePath = `${storageUuid}.md`;

    // Upload to storage
    const bodyBytes = new TextEncoder().encode(content);
    const supabase = createAdminClient();
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, bodyBytes, { contentType: "text/markdown", upsert: false });

    if (uploadError) {
      console.error("Storage upload failed:", uploadError.message);
      return NextResponse.json({ error: "Failed to save content." }, { status: 500 });
    }

    // Resolve custom_slug if provided
    let resolvedCustomSlug: string | null = null;
    if (custom_slug && typeof custom_slug === "string") {
      // Get user handle
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();

      const handle = slugifyHandle(profile?.display_name || "", user.id);
      const candidate = `${handle}/${custom_slug.replace(/^\/+|\/+$/g, "")}`;

      // Validate format
      if (/^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]\/[a-z0-9][a-z0-9-.]{0,98}[a-z0-9]$/.test(candidate)) {
        // Check uniqueness
        const { data: existing } = await supabase
          .from("shares")
          .select("id")
          .eq("custom_slug", candidate)
          .maybeSingle();

        if (!existing) {
          resolvedCustomSlug = candidate;
        }
      }
    }

    // Insert share
    const { error: dbError } = await supabase.from("shares").insert({
      slug,
      filename: resolvedFilename,
      storage_path: storagePath,
      content_text: contentText,
      file_size: bodyBytes.length,
      mime_type: "text/markdown",
      delete_token: deleteToken,
      user_id: user.id,
      title: title || resolvedTitle,
      source: "editor",
      is_private: !!is_private,
      custom_slug: resolvedCustomSlug,
    });

    if (dbError) {
      console.error("DB insert failed:", dbError.message);
      // Compensating: remove uploaded file
      supabase.storage.from(STORAGE_BUCKET).remove([storagePath]).then(() => {});
      return NextResponse.json({ error: "Failed to save metadata." }, { status: 500 });
    }

    const origin = request.headers.get("host") || "localhost:3000";
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const shareUrl = resolvedCustomSlug
      ? `${protocol}://${origin}/@${resolvedCustomSlug}`
      : `${protocol}://${origin}/s/${slug}`;

    return NextResponse.json({
      slug,
      url: shareUrl,
      filename: resolvedFilename,
      title: title || resolvedTitle,
      custom_slug: resolvedCustomSlug,
    }, { status: 201 });
  } catch (err) {
    console.error("Publish error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

function slugifyHandle(displayName: string, fallbackId: string): string {
  const slug = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  return slug || `user-${fallbackId.slice(0, 8)}`;
}
