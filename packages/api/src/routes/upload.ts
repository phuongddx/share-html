/**
 * POST /upload — Upload an HTML file to Supabase Storage and register a share record.
 *
 * Flow: validate file → rate limit → extract text → upload to storage → insert DB row
 * Compensating transaction: if DB insert fails, the uploaded storage object is deleted.
 */

import { Hono } from "hono";
import { randomUUID } from "crypto";
import { createAdminClient } from "@dropitx/shared/supabase/admin";
import { generateSlug, generateDeleteToken } from "../lib/nanoid";
import { extractTextFromHtml, extractTextFromMarkdown } from "../lib/extract-text";
import { checkRateLimit, getClientIp } from "../lib/rate-limit";
import type { AppEnv } from "../app";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_EXTENSIONS = [".html", ".htm", ".md"];
const STORAGE_BUCKET = "html-files";

const upload = new Hono<AppEnv>();

upload.post("/", async (c) => {
  try {
    // Rate limit check
    const ip = getClientIp(c);
    const rateResult = await checkRateLimit(ip);
    if (!rateResult.success) {
      c.header("X-RateLimit-Limit", String(rateResult.limit));
      c.header("X-RateLimit-Remaining", String(rateResult.remaining));
      c.header("X-RateLimit-Reset", String(rateResult.reset));
      return c.json(
        { error: "Rate limit exceeded. Please try again later." },
        429,
      );
    }

    // Parse multipart form data
    const formData = await c.req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return c.json(
        { error: "No file provided. Use 'file' field in form data." },
        400,
      );
    }

    // Validate file extension
    const filename = file.name;
    const lowerName = filename.toLowerCase();
    const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    if (!hasValidExt) {
      return c.json(
        { error: "Invalid file extension. Only .html, .htm, and .md files are accepted." },
        400,
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return c.json(
        { error: "File too large. Maximum size is 50MB." },
        400,
      );
    }

    const isMarkdown = lowerName.endsWith(".md");
    const mimeType = isMarkdown ? "text/markdown" : "text/html";

    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const fileContent = new TextDecoder("utf-8", { fatal: true }).decode(arrayBuffer);

    // Extract plain text for search indexing
    const contentText = isMarkdown
      ? extractTextFromMarkdown(fileContent)
      : extractTextFromHtml(fileContent);

    // Generate identifiers
    const slug = generateSlug();
    const deleteToken = generateDeleteToken();
    const storageUuid = randomUUID();
    const storagePath = `${storageUuid}${isMarkdown ? ".md" : ".html"}`;

    // Get authenticated user (if any)
    const auth = c.get("auth");
    const userId = auth.userId || null;

    // Upload to Supabase Storage (admin client bypasses RLS)
    const body = new TextEncoder().encode(fileContent);
    const supabase = createAdminClient();
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, body, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload failed:", JSON.stringify(uploadError, null, 2));
      return c.json(
        { error: "Failed to upload file. Please try again." },
        500,
      );
    }

    // Insert metadata into shares table
    const { error: dbError } = await supabase.from("shares").insert({
      slug,
      filename,
      storage_path: storagePath,
      content_text: contentText,
      file_size: file.size,
      mime_type: mimeType,
      delete_token: deleteToken,
      user_id: userId,
    });

    if (dbError) {
      console.error("DB insert failed:", dbError.message);

      // Compensating transaction: remove the uploaded storage object
      const { error: cleanupError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([storagePath]);

      if (cleanupError) {
        console.error(
          "CRITICAL: Storage cleanup also failed for path:",
          storagePath,
          cleanupError.message,
        );
      }

      return c.json(
        { error: "Failed to save file metadata. Please try again." },
        500,
      );
    }

    // Build the shareable URL
    const webUrl = process.env.WEB_URL || "https://dropitx.com";
    const shareUrl = `${webUrl}/s/${slug}`;

    // Auth users delete via dashboard — don't expose delete_token
    const responsePayload: Record<string, string> = {
      slug,
      url: shareUrl,
      filename,
      deleteToken: userId ? "" : deleteToken,
    };

    return c.json(responsePayload, 201);
  } catch (err) {
    console.error("Upload error:", err);
    return c.json(
      { error: "Internal server error." },
      500,
    );
  }
});

export { upload };
