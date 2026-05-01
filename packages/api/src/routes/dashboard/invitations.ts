/**
 * GET /dashboard/invitations — Pending team invites for the authenticated user's email.
 */

import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import { createAdminClient } from "@dropitx/shared/supabase/admin";
import type { AppEnv } from "../../app";

const invitations = new Hono<AppEnv>();

invitations.get("/", requireAuth, async (c) => {
  try {
    const auth = c.get("auth");
    const admin = createAdminClient();

    const { data: invites, error } = await admin
      .from("team_invites")
      .select("id, role, token, created_at, expires_at, invited_by, teams!inner(name, slug)")
      .eq("email", auth.email!.toLowerCase())
      .eq("status", "pending")
      .gt("expires_at", "now")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("GET /dashboard/invitations query error:", error);
      return c.json({ error: "Failed to fetch invitations" }, 500);
    }

    const rows = (invites ?? []) as Record<string, unknown>[];
    const inviterIds = [...new Set(rows.map((i) => i.invited_by).filter(Boolean).map(String))];
    const inviterMap: Record<string, string> = {};
    if (inviterIds.length > 0) {
      const { data: profiles } = await admin
        .from("user_profiles")
        .select("id, display_name")
        .in("id", inviterIds);
      for (const p of profiles ?? []) {
        inviterMap[p.id] = p.display_name;
      }
    }

    const result = rows.map((inv) => {
      const teams = inv.teams as Record<string, unknown> | Record<string, unknown>[] | null;
      const team = Array.isArray(teams) ? teams[0] : teams;
      return {
        id: inv.id,
        role: inv.role,
        token: inv.token,
        created_at: inv.created_at,
        expires_at: inv.expires_at,
        team_name: (team as Record<string, string>)?.name,
        team_slug: (team as Record<string, string>)?.slug,
        inviter_name: inviterMap[String(inv.invited_by ?? "")] ?? null,
      };
    });

    return c.json({ invites: result });
  } catch (err) {
    console.error("GET /dashboard/invitations error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { invitations };
