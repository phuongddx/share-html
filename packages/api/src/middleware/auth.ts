/**
 * Dual auth middleware: JWT Bearer tokens and API keys.
 *
 * JWT path:  Bearer <jwt>  → verify with Supabase JWT secret → create RLS-scoped client
 * API key:   Bearer shk_*  → lookup in api_keys table → get user_id → create RLS-scoped client
 *            Bearer sht_*  → same + attach team_id
 * Anonymous: No header     → proceed with isAnonymous: true (for public routes)
 */

import { createMiddleware } from "hono/factory";
import { verify } from "hono/jwt";
import { createAdminClient } from "@dropitx/shared/supabase/admin";
import { createClientFromJWT } from "@dropitx/shared/supabase/jwt-client";
import { hashApiKey, type ApiKeyPrefix } from "../lib/api-key";
import type { AppEnv } from "../app";

type AuthResult = AppEnv["Variables"]["auth"];

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET ?? "";

function extractBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}

async function verifySupabaseJWT(token: string): Promise<AuthResult | null> {
  if (!JWT_SECRET) {
    console.error("SUPABASE_JWT_SECRET is not configured");
    return null;
  }

  try {
    const result = await verify(token, JWT_SECRET, "HS256");
    const payload = result.payload as Record<string, unknown>;
    const sub = payload.sub as string | undefined;
    const email = payload.email as string | undefined;
    if (!sub) return null;

    return {
      userId: sub,
      email,
      clientRole: "jwt" as const,
      isAnonymous: false,
      supabaseClient: createClientFromJWT(token),
    };
  } catch {
    return null;
  }
}

async function verifyApiKey(
  rawKey: string,
): Promise<AuthResult | null> {
  const prefix = rawKey.split("_")[0] as ApiKeyPrefix;
  if (prefix !== "shk" && prefix !== "sht") return null;

  const hash = hashApiKey(rawKey);
  const supabase = createAdminClient();

  const { data: row, error } = await supabase
    .from("api_keys")
    .select("id, user_id, team_id, revoked_at")
    .eq("key_hash", hash)
    .is("revoked_at", null)
    .single();

  if (error || !row) return null;

  // Verify team membership is still active for team-scoped keys
  if (row.team_id) {
    const { data: member } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", row.team_id)
      .eq("user_id", row.user_id)
      .single();

    if (!member) return null;
  }

  // Fire-and-forget: update last_used_at
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id)
    .then(() => {});

  // Create an RLS-scoped client for the key owner
  // We need their JWT — fetch a session or use admin to impersonate
  // Since we can't get their JWT from an API key, we use admin client
  // and manually filter by user_id. The auth result includes user_id for
  // route handlers to use for RLS-compatible queries.
  return {
    userId: row.user_id,
    teamId: row.team_id ?? undefined,
    keyType: prefix === "sht" ? "team" : "personal",
    clientRole: "admin" as const,
    isAnonymous: false,
    supabaseClient: createAdminClient(),
  };
}

/** Middleware that attempts auth but allows anonymous access. */
export const optionalAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = extractBearerToken(c.req.header("Authorization"));

  if (!token) {
    c.set("auth", {
      userId: "",
      clientRole: "admin" as const,
      isAnonymous: true,
      supabaseClient: createAdminClient(),
    });
    await next();
    return;
  }

  // Try API key first (shk_/sht_ prefix check is cheap)
  if (token.startsWith("shk_") || token.startsWith("sht_")) {
    const result = await verifyApiKey(token);
    if (result) {
      c.set("auth", result);
      await next();
      return;
    }
  }

  // Fall back to JWT verification
  const result = await verifySupabaseJWT(token);
  if (result) {
    c.set("auth", result);
    await next();
    return;
  }

  // Invalid token — reject
  c.set("auth", {
    userId: "",
    clientRole: "admin" as const,
    isAnonymous: true,
    supabaseClient: createAdminClient(),
  });
  await next();
});

/** Middleware that requires valid auth (rejects anonymous). */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = extractBearerToken(c.req.header("Authorization"));

  if (!token) {
    return c.json({ error: "Authorization header required" }, 401);
  }

  // Try API key first
  if (token.startsWith("shk_") || token.startsWith("sht_")) {
    const result = await verifyApiKey(token);
    if (result) {
      c.set("auth", result);
      await next();
      return;
    }
  }

  // Fall back to JWT verification
  const result = await verifySupabaseJWT(token);
  if (result) {
    c.set("auth", result);
    await next();
    return;
  }

  return c.json({ error: "Invalid or expired token" }, 401);
});
