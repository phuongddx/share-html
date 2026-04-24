/**
 * API key authentication middleware for REST API endpoints.
 * Extracts Bearer token from Authorization header, validates against api_keys table.
 */

import { type NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { hashApiKey } from "./api-key";

export interface ApiAuthResult {
  userId: string;
  keyId: string;
}

/**
 * Validate the API key from the request's Authorization header.
 * Returns the authenticated user ID and key ID, or null if invalid.
 */
export async function authenticateApiKey(
  request: NextRequest,
): Promise<ApiAuthResult | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const key = authHeader.slice(7);
  if (!key.startsWith("shk_")) return null;

  const hash = hashApiKey(key);
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("api_keys")
    .select("id, user_id")
    .eq("key_hash", hash)
    .is("revoked_at", null)
    .single();

  if (!data) return null;

  // Update last_used_at (fire and forget — non-blocking)
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});

  return { userId: data.user_id, keyId: data.id };
}
