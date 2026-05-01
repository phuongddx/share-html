import { Hono } from "hono";
import { createClientFromJWT } from "@dropitx/shared/supabase/jwt-client";
import type { AppEnv } from "../../app";
import type { Share } from "@dropitx/shared/types/share";

const getShare = new Hono<AppEnv>();

/**
 * GET /shares/:slug
 * Returns public share data (for SSR viewer page)
 * No authentication required
 */
getShare.get("/:slug", async (c) => {
  const slug = c.req.param("slug");

  // Use anon client for public share access
  const supabase = createClientFromJWT("");

  try {
    const { data: share, error } = await supabase
      .from("shares")
      .select("*")
      .eq("slug", slug)
      .single();

    if (error || !share) {
      return c.json({ error: "Share not found" }, 404);
    }

    // Check if share is private and user has access via cookie
    if (share.is_private) {
      const accessCookie = c.req.header("cookie") ?? "";
      const hasAccess = accessCookie.includes(`share-access-${slug}=granted`);

      if (!hasAccess) {
        // Return limited data for password-protected shares
        return c.json(
          {
            slug: share.slug,
            filename: share.filename,
            is_private: true,
            has_password: !!share.password_hash,
          },
          200
        );
      }
    }

    return c.json(share as Share);
  } catch (err) {
    console.error("Unexpected error fetching share:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { getShare };
