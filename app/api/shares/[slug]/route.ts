/**
 * DELETE /api/shares/[slug] — Delete a share by slug with valid delete token.
 *
 * Flow: parse body → lookup share → verify token → delete storage → delete DB row
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const STORAGE_BUCKET = "html-files";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    // Validate slug format (defense-in-depth)
    if (!slug || !/^[a-zA-Z0-9_-]{1,20}$/.test(slug)) {
      return NextResponse.json(
        { error: "Invalid slug format." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { deleteToken } = body;

    if (!deleteToken || typeof deleteToken !== "string") {
      return NextResponse.json(
        { error: "deleteToken is required." },
        { status: 400 },
      );
    }

    const supabase = createServerClient();

    // Lookup share by slug
    const { data: share, error: lookupError } = await supabase
      .from("shares")
      .select("id, storage_path, delete_token")
      .eq("slug", slug)
      .single();

    if (lookupError || !share) {
      return NextResponse.json(
        { error: "Share not found." },
        { status: 404 },
      );
    }

    // Verify delete token
    if (share.delete_token !== deleteToken) {
      return NextResponse.json(
        { error: "Invalid delete token." },
        { status: 403 },
      );
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([share.storage_path]);

    if (storageError) {
      console.error("Storage deletion failed:", storageError.message);
      // Continue to delete DB row even if storage deletion fails
    }

    // Delete from database
    const { error: dbError } = await supabase
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
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
