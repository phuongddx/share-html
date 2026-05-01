/**
 * GET /api/dashboard/teams/[slug]/events — Paginated team event log.
 * Returns team_events ordered by created_at descending with total count.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeamMember } from "../route";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const result = await requireTeamMember(slug);
    if (!result.ok) return result.error;
    const { team, supabase } = result;

    const url = request.nextUrl;
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 100);
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    const { data: events, error } = await supabase
      .from("team_events")
      .select("id, event_type, actor_id, target_user_id, metadata, created_at")
      .eq("team_id", team.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("List events failed:", error.message);
      return NextResponse.json({ error: "Failed to list events" }, { status: 500 });
    }

    const { count } = await supabase
      .from("team_events")
      .select("*", { count: "exact", head: true })
      .eq("team_id", team.id);

    return NextResponse.json({
      events: events ?? [],
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error("GET /api/dashboard/teams/[slug]/events error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
