/**
 * GET /dashboard/teams/:slug/shares — List shares belonging to this team.
 * Returns team shares with full share data embedded.
 */

import { Hono } from "hono";
import { requireAuth } from "../../../middleware/auth";
import { requireTeamMember } from "../../../lib/require-team-member";
import type { AppEnv } from "../../../app";

const shares = new Hono<AppEnv>();

shares.get("/:slug/shares", requireAuth, requireTeamMember(), async (c) => {
  try {
    const teamMember = c.get("teamMember");
    if (!teamMember) {
      return c.json({ error: "Team membership required" }, 403);
    }

    const { teamId } = teamMember;
    const supabase = c.get("auth").supabaseClient;

    const limit = Math.max(1, Math.min(100, parseInt(c.req.query("limit") || "20", 10) || 20));
    const offset = Math.max(0, parseInt(c.req.query("offset") || "0", 10) || 0);

    const { count, error: countError } = await supabase
      .from("team_shares")
      .select("*", { count: "exact", head: true })
      .eq("team_id", teamId);

    if (countError) {
      console.error("Team shares count failed:", countError.message);
      return c.json({ error: "Failed to count shares" }, 500);
    }

    const { data, error } = await supabase
      .from("team_shares")
      .select("share_id, created_at, shared_by, shares(id, slug, filename, title, custom_slug, source, is_private, mime_type, file_size, created_at, updated_at, expires_at, view_count)")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Team shares list failed:", error.message);
      return c.json({ error: "Failed to list team shares" }, 500);
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

    return c.json({ shares, total: count ?? 0 });
  } catch (err) {
    console.error("GET /dashboard/teams/:slug/shares error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { shares };
