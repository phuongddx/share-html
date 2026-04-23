/**
 * DELETE /api/shares/[slug] — Delete a share.
 *
 * Two auth paths:
 * 1. Anonymous: requires valid deleteToken in body
 * 2. Authenticated owner: verified via session (no token needed)
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, createAdminClient } from "@/utils/supabase/server";

const STORAGE_BUCKET = "html-files";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    if (!slug || !/^[a-zA-Z0-9_-]{1,20}$/.test(slug)) {
      return NextResponse.json(
        { error: "Invalid slug format." },
        { status: 400 },
      );
    }

    // Try auth-based deletion first
    const cookieStore = await cookies();
    const authClient = createClient(cookieStore);
    const { data: { user } } = await authClient.auth.getUser();

    // Use admin client for storage + DB ops (bypasses RLS)
    const adminClient = createAdminClient();

    const { data: share, error: lookupError } = await adminClient
      .from("shares")
      .select("id, storage_path, delete_token, user_id")
      .eq("slug", slug)
      .single();

    if (lookupError || !share) {
      return NextResponse.json({ error: "Share not found." }, { status: 404 });
    }

    // Authorization: either owner (auth) or valid delete token (anonymous)
    const isOwner = user && share.user_id === user.id;

    if (!isOwner) {
      const body = await request.json().catch(() => ({}));
      const { deleteToken } = body;
      if (!deleteToken || share.delete_token !== deleteToken) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 });
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
      return NextResponse.json(
        { error: "Failed to delete share record." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete share error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
