import { Hono } from "hono";
import type { AppEnv } from "../../app";
import type { Share } from "@dropitx/shared/types/share";

const favorites = new Hono<AppEnv>();

/**
 * GET /dashboard/favorites
 * Returns user's bookmarked shares
 */
favorites.get("/", async (c) => {
  const auth = c.get("auth");
  const supabase = auth.supabaseClient;
  const userId = auth.userId;

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const { data, error } = await supabase
      .from("shares")
      .select("*")
      .eq("user_id", userId)
      .eq("is_private", false)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching favorites:", error.message);
      return c.json({ error: "Failed to fetch favorites" }, 500);
    }

    return c.json((data ?? []) as Share[]);
  } catch (err) {
    console.error("Unexpected error fetching favorites:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { favorites };
