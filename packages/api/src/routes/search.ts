import { Hono } from "hono";
import { createClientFromJWT } from "@dropitx/shared/supabase/jwt-client";
import type { AppEnv } from "../app";
import type { SearchResult } from "@dropitx/shared/types/share";

/** Clamp an integer between min and max, returning default on failure. */
function clampInt(
  raw: string | null,
  min: number,
  max: number,
  fallback: number,
): number {
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

const search = new Hono<AppEnv>();

search.get("/", async (c) => {
  const q = (c.req.query("q") ?? "").trim();

  // Validate query length
  if (q.length < 2) {
    return c.json(
      { error: "Query must be at least 2 characters" },
      400,
    );
  }
  if (q.length > 200) {
    return c.json(
      { error: "Query must be at most 200 characters" },
      400,
    );
  }

  const page = clampInt(c.req.query("page") ?? null, 1, 1000, 1);
  const limit = clampInt(c.req.query("limit") ?? null, 1, 100, 20);
  const offset = (page - 1) * limit;

  try {
    const auth = c.get("auth");
    const supabase = auth.isAnonymous
      ? createClientFromJWT("") // Anon client for unauthenticated
      : c.get("auth").supabaseClient;

    const { data, error } = await supabase.rpc("search_shares", {
      query_term: q,
      result_limit: limit,
      result_offset: offset,
    });

    if (error) {
      console.error("search_shares RPC error:", error.message);
      return c.json(
        { error: "Search failed" },
        500,
      );
    }

    const results = (data ?? []) as SearchResult[];
    return c.json({
      results,
      total: results.length,
      page,
    });
  } catch (err) {
    console.error("search_shares unexpected error:", err);
    return c.json(
      { error: "Internal server error" },
      500,
    );
  }
});

export { search };
