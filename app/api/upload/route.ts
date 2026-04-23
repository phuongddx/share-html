/**
 * POST /api/upload — Upload an HTML file to Supabase Storage and register a share record.
 *
 * Flow: validate file → rate limit → extract text → upload to storage → insert DB row
 * Compensating transaction: if DB insert fails, the uploaded storage object is deleted.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { createAdminClient, createClient } from "@/utils/supabase/server";
import { generateSlug, generateDeleteToken } from "@/lib/nanoid";
import { extractTextFromHtml, extractTextFromMarkdown } from "@/lib/extract-text";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_EXTENSIONS = [".html", ".htm", ".md"];
const STORAGE_BUCKET = "html-files";

function getClientIp(request: NextRequest): string {
  // Prefer x-real-ip set by Vercel/trusted proxy over client-settable x-forwarded-for
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // On Vercel, the rightmost entry is the trusted proxy; leftmost is the client
    const entries = forwarded.split(",").map((s) => s.trim());
    return entries[entries.length - 1];
  }

  return "unknown";
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit check
    const ip = getClientIp(request);
    const rateResult = await checkRateLimit(ip);
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(rateResult.limit),
            "X-RateLimit-Remaining": String(rateResult.remaining),
            "X-RateLimit-Reset": String(rateResult.reset),
          },
        },
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided. Use 'file' field in form data." },
        { status: 400 },
      );
    }

    // Validate file extension
    const filename = file.name;
    const lowerName = filename.toLowerCase();
    const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    if (!hasValidExt) {
      return NextResponse.json(
        { error: "Invalid file extension. Only .html, .htm, and .md files are accepted." },
        { status: 400 },
      );
    }

    // MIME type not validated — browsers are unreliable for .md files;
    // extension check above is sufficient.

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 50MB." },
        { status: 400 },
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

    // Get authenticated user (if any) — uses anon client for real auth check
    const cookieStore = await cookies();
    const authClient = createClient(cookieStore);
    const { data: { user } } = await authClient.auth.getUser();

    // Upload to Supabase Storage (admin client bypasses RLS)
    // Use TextEncoder to produce Uint8Array — Vercel runtime rejects raw strings
    // as fetch body ("Invalid Compact"), while Node.js implicitly wraps them.
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
      return NextResponse.json(
        { error: "Failed to upload file. Please try again." },
        { status: 500 },
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
      user_id: user?.id ?? null,
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

      return NextResponse.json(
        { error: "Failed to save file metadata. Please try again." },
        { status: 500 },
      );
    }

    // Build the shareable URL
    const origin = request.headers.get("host") || "localhost:3000";
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const shareUrl = `${protocol}://${origin}/s/${slug}`;

    // Auth users delete via dashboard — don't expose delete_token
    const responsePayload: Record<string, string> = {
      slug,
      url: shareUrl,
      filename,
      deleteToken: user ? "" : deleteToken,
    };

    return NextResponse.json(responsePayload, { status: 201 });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
