import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
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

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = (searchParams.get("q") ?? "").trim();

  // Validate query length
  if (q.length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters" },
      { status: 400 },
    );
  }
  if (q.length > 200) {
    return NextResponse.json(
      { error: "Query must be at most 200 characters" },
      { status: 400 },
    );
  }

  const page = clampInt(searchParams.get("page"), 1, 1000, 1);
  const limit = clampInt(searchParams.get("limit"), 1, 100, 20);
  const offset = (page - 1) * limit;

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data, error } = await supabase.rpc("search_shares", {
      query_term: q,
      result_limit: limit,
      result_offset: offset,
    });

    if (error) {
      console.error("search_shares RPC error:", error.message);
      return NextResponse.json(
        { error: "Search failed" },
        { status: 500 },
      );
    }

    const results = (data ?? []) as SearchResult[];
    return NextResponse.json({
      results,
      total: results.length,
      page,
    });
  } catch (err) {
    console.error("search_shares unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
