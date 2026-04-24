/**
 * DELETE /api/v1/keys/[id] — Revoke an API key (cookie auth).
 * Sets revoked_at to NOW() rather than deleting the row for audit purposes.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, createAdminClient } from "@/utils/supabase/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const cookieStore = await cookies();
    const authClient = createClient(cookieStore);
    const { data: { user } } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createAdminClient();

    // Verify ownership before revoking
    const { data: key, error: fetchError } = await supabase
      .from("api_keys")
      .select("user_id")
      .eq("id", id)
      .is("revoked_at", null)
      .single();

    if (fetchError || !key) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    if (key.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabase
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("Key revocation failed:", error.message);
      return NextResponse.json(
        { error: "Failed to revoke API key" },
        { status: 500 },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("DELETE /api/v1/keys/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
