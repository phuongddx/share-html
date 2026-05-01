import { Hono } from "hono";
import type { AppEnv } from "../../app";
import type { Share } from "@dropitx/shared/types/share";

const dashboardShares = new Hono<AppEnv>();

export type ShareWithPasswordFlag = Omit<Share, "password_hash"> & {
  has_password: boolean;
};

export type TeamShareWithDetails = {
  id: string;
  slug: string;
  filename: string;
  title: string | null;
  mime_type: string;
  view_count: number;
  file_size: number | null;
  created_at: string;
};

/**
 * GET /dashboard/shares
 * Returns user's personal shares with stats
 */
dashboardShares.get("/", async (c) => {
  const auth = c.get("auth");
  const supabase = auth.supabaseClient;
  const userId = auth.userId;

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const { data: shares, error } = await supabase
      .from("shares")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching shares:", error.message);
      return c.json({ error: "Failed to fetch shares" }, 500);
    }

    // Strip password_hash from client data; expose only a boolean flag
    const shareList: ShareWithPasswordFlag[] = (shares ?? []).map(
      (s: Share) => {
        const { password_hash, ...rest } = s;
        return { ...rest, has_password: !!password_hash };
      }
    );

    return c.json(shareList);
  } catch (err) {
    console.error("Unexpected error fetching shares:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { dashboardShares };
