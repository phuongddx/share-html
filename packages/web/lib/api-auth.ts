/**
 * API key authentication middleware for REST API endpoints.
 * Extracts Bearer token from Authorization header, validates against api_keys table.
 * Supports both personal (shk_) and team (sht_) API keys.
 */

import { type NextRequest } from "next/server";
import { createAdminClient } from "@dropitx/shared/supabase/admin";
import { hashApiKey } from "./api-key";
import { PERSONAL_KEY_PREFIX, TEAM_KEY_PREFIX } from "@dropitx/shared/utils/team-utils";

export interface ApiAuthResult {
  userId: string;
  keyId: string;
  /** Team context from team-scoped API key. Null for personal keys. */
  teamId: string | null;
}

/** Valid API key prefixes — reject anything not in this list. (Red Team Fix #8) */
const VALID_KEY_PREFIXES = [PERSONAL_KEY_PREFIX, TEAM_KEY_PREFIX] as const;

/**
 * Validate the API key from the request's Authorization header.
 * Returns the authenticated user ID, key ID, and optional team ID, or null if invalid.
 */
export async function authenticateApiKey(
  request: NextRequest,
): Promise<ApiAuthResult | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const key = authHeader.slice(7);
  // Red Team Fix #8: Accept prefixes via validated constant list only
  if (!VALID_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) return null;

  const hash = hashApiKey(key);
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("api_keys")
    .select("id, user_id, team_id")
    .eq("key_hash", hash)
    .is("revoked_at", null)
    .single();

  if (!data) return null;

  // If team key, verify user is still a member of that team
  if (data.team_id) {
    const { data: member } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", data.team_id)
      .eq("user_id", data.user_id)
      .single();

    if (!member) return null; // No longer a member — key is invalid
  }

  // Update last_used_at (fire and forget — non-blocking)
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});

  return {
    userId: data.user_id,
    keyId: data.id,
    teamId: data.team_id ?? null,
  };
}
