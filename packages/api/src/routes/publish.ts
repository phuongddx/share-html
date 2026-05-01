/**
 * POST /publish — Publish markdown content from the editor.
 * Auth required. Content stored identically to file uploads.
 */

import { Hono } from "hono";
import { randomUUID } from "crypto";
import { createAdminClient } from "@dropitx/shared/supabase/admin";
import { generateSlug, generateDeleteToken } from "../lib/nanoid";
import { extractTextFromMarkdown } from "../lib/extract-text";
import { validateEditorContent } from "@dropitx/shared/validation/editor-content";
import { extractTitleFromMarkdown } from "../lib/extract-title-from-markdown";
import { checkRateLimit, getClientIp } from "../lib/rate-limit";
import type { AppEnv } from "../app";

const STORAGE_BUCKET = "html-files";

const publish = new Hono<AppEnv>();

publish.post("/", async (c) => {
  try {
    // Rate limit
    const ip = getClientIp(c);
    const rateResult = await checkRateLimit(ip);
    if (!rateResult.success) {
      return c.json(
        { error: "Rate limit exceeded. Please try again later." },
        429,
      );
    }

    // Auth check
    const auth = c.get("auth");
    if (!auth.userId) {
      return c.json({ error: "Authentication required." }, 401);
    }

    // Parse body
    const body = await c.req.json();
    const { content, filename, title, is_private, custom_slug } = body as {
      content?: string;
      filename?: string;
      title?: string;
      is_private?: boolean;
      custom_slug?: string;
    };

    if (!content || typeof content !== "string") {
      return c.json({ error: "Content is required." }, 400);
    }

    // Validate content
    const validation = validateEditorContent(content);
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
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
      return c.json({ error: "Failed to save content." }, 500);
    }

    // Resolve custom_slug if provided
    let resolvedCustomSlug: string | null = null;
    if (custom_slug && typeof custom_slug === "string") {
      // Get user handle
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("display_name")
        .eq("id", auth.userId)
        .single();

      const handle = slugifyHandle(profile?.display_name || "", auth.userId);
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
      user_id: auth.userId,
      title: title || resolvedTitle,
      source: "editor",
      is_private: !!is_private,
      custom_slug: resolvedCustomSlug,
    });

    if (dbError) {
      console.error("DB insert failed:", dbError.message);
      // Compensating: remove uploaded file
      supabase.storage.from(STORAGE_BUCKET).remove([storagePath]).then(() => {});
      return c.json({ error: "Failed to save metadata." }, 500);
    }

    const webUrl = process.env.WEB_URL || "https://dropitx.com";
    const shareUrl = resolvedCustomSlug
      ? `${webUrl}/@${resolvedCustomSlug}`
      : `${webUrl}/s/${slug}`;

    return c.json({
      slug,
      url: shareUrl,
      filename: resolvedFilename,
      title: title || resolvedTitle,
      custom_slug: resolvedCustomSlug,
    }, 201);
  } catch (err) {
    console.error("Publish error:", err);
    return c.json({ error: "Internal server error." }, 500);
  }
});

function slugifyHandle(displayName: string, fallbackId: string): string {
  const slug = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  return slug || `user-${fallbackId.slice(0, 8)}`;
}

export { publish };
