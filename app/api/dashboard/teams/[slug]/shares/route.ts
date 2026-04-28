/**
 * GET /api/dashboard/teams/[slug]/shares — List shares belonging to this team.
 * Returns team shares with full share data embedded.
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

    const { searchParams } = request.nextUrl;
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "20", 10) || 20));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0);

    const { count, error: countError } = await supabase
      .from("team_shares")
      .select("*", { count: "exact", head: true })
      .eq("team_id", team.id);

    if (countError) {
      console.error("Team shares count failed:", countError.message);
      return NextResponse.json({ error: "Failed to count shares" }, { status: 500 });
    }

    const { data, error } = await supabase
      .from("team_shares")
      .select("share_id, created_at, shared_by, shares(id, slug, filename, title, custom_slug, source, is_private, mime_type, file_size, created_at, updated_at, expires_at, view_count)")
      .eq("team_id", team.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Team shares list failed:", error.message);
      return NextResponse.json({ error: "Failed to list team shares" }, { status: 500 });
    }

    // Flatten the structure: merge share data with team_share metadata
    interface ShareRow {
      id: string; slug: string; filename: string; title: string | null;
      custom_slug: string | null; source: string | null; is_private: boolean;
      mime_type: string; file_size: number | null; created_at: string;
      updated_at: string; expires_at: string; view_count: number;
    }
    interface TeamShareRow {
      share_id: string; created_at: string; shared_by: string;
      shares: ShareRow;
    }

    const shares = (data as unknown as TeamShareRow[] | null)?.map((row) => ({
      ...row.shares,
      shared_by: row.shared_by,
      shared_at: row.created_at,
    })) ?? [];

    return NextResponse.json({ shares, total: count ?? 0 });
  } catch (err) {
    console.error("GET /api/dashboard/teams/[slug]/shares error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
