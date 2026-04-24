/**
 * POST /api/shares/[slug]/set-password — Set, update, or remove a share password.
 *
 * Auth: session cookie (owner via user_id) OR delete_token (anonymous uploader).
 * Body: { password?: string | null, delete_token?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { hashPassword } from "@/lib/password";
import type { Share } from "@/types/share";

const MIN_PASSWORD_LENGTH = 4;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    let body: { password?: unknown; delete_token?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { password, delete_token } = body;

    const supabase = createAdminClient();
    const { data: share, error } = await supabase
      .from("shares")
      .select("id, user_id, delete_token, password_hash")
      .eq("slug", slug)
      .single<Pick<Share, "id" | "user_id" | "delete_token" | "password_hash">>();

    if (error || !share) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    // Auth: session owner OR delete_token
    let authorized = false;

    if (delete_token && typeof delete_token === "string") {
      authorized = delete_token === share.delete_token;
    }

    if (!authorized) {
      const cookieStore = await cookies();
      const authClient = createClient(cookieStore);
      const { data: { user } } = await authClient.auth.getUser();
      if (user && user.id === share.user_id) {
        authorized = true;
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let newHash: string | null = null;

    if (password === null || password === "" || password === undefined) {
      // Remove password protection
      newHash = null;
    } else if (typeof password === "string") {
      if (password.length < MIN_PASSWORD_LENGTH) {
        return NextResponse.json(
          { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
          { status: 400 },
        );
      }
      newHash = await hashPassword(password);
    } else {
      return NextResponse.json({ error: "password must be a string or null" }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from("shares")
      .update({ password_hash: newHash, updated_at: new Date().toISOString() })
      .eq("id", share.id);

    if (updateError) {
      console.error("set-password update failed:", updateError.message);
      return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
    }

    return NextResponse.json({ has_password: newHash !== null });
  } catch (err) {
    console.error("POST /api/shares/[slug]/set-password error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
