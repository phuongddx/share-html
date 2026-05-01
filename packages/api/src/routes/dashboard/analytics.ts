import { Hono } from "hono";
import type { AppEnv } from "../../app";
import type {
  ShareAnalytics,
  TopShare,
  ViewTimeSeriesPoint,
  ReferrerBreakdown,
  GeoBreakdown,
} from "@dropitx/shared/types/analytics";

const analytics = new Hono<AppEnv>();

/**
 * GET /dashboard/analytics
 * Returns user's analytics overview
 */
analytics.get("/", async (c) => {
  const auth = c.get("auth");
  const supabase = auth.supabaseClient;
  const userId = auth.userId;

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    // Get total views across all user's shares
    const { data: totalViews, error: totalError } = await supabase
      .from("share_views")
      .select("id", { count: "exact" })
      .eq("share", (qb: any) =>
        qb.select("id").from("shares").eq("user_id", userId)
      );

    // Get unique views
    const { data: uniqueViews, error: uniqueError } = await supabase
      .from("share_views")
      .select("id", { count: "exact" })
      .eq("is_unique", true)
      .eq("share", (qb: any) =>
        qb.select("id").from("shares").eq("user_id", userId)
      );

    // Get views today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: viewsToday, error: todayError } = await supabase
      .from("share_views")
      .select("id", { count: "exact" })
      .gte("viewed_at", today.toISOString())
      .eq("share", (qb: any) =>
        qb.select("id").from("shares").eq("user_id", userId)
      );

    // Get views in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: views7d, error: views7dError } = await supabase
      .from("share_views")
      .select("id", { count: "exact" })
      .gte("viewed_at", sevenDaysAgo.toISOString())
      .eq("share", (qb: any) =>
        qb.select("id").from("shares").eq("user_id", userId)
      );

    if (totalError || uniqueError || todayError || views7dError) {
      console.error("Error fetching analytics:", {
        totalError,
        uniqueError,
        todayError,
        views7dError,
      });
      return c.json({ error: "Failed to fetch analytics" }, 500);
    }

    const analytics: ShareAnalytics = {
      total_views: totalViews?.length ?? 0,
      unique_views: uniqueViews?.length ?? 0,
      views_today: viewsToday?.length ?? 0,
      views_7d: views7d?.length ?? 0,
      avg_daily_views: 0, // Will be calculated by client
    };

    return c.json(analytics);
  } catch (err) {
    console.error("Unexpected error fetching analytics:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * GET /dashboard/analytics/:slug
 * Returns per-share analytics with share details
 */
analytics.get("/:slug", async (c) => {
  const auth = c.get("auth");
  const supabase = auth.supabaseClient;
  const userId = auth.userId;
  const slug = c.req.param("slug");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    // First verify user owns this share and get share details
    const { data: share, error: shareError } = await supabase
      .from("shares")
      .select("*")
      .eq("slug", slug)
      .eq("user_id", userId)
      .single();

    if (shareError || !share) {
      return c.json({ error: "Share not found" }, 404);
    }

    // Get time series data (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: views, error: viewsError } = await supabase
      .from("share_views")
      .select("viewed_at, is_unique")
      .eq("share_id", share.id)
      .gte("viewed_at", thirtyDaysAgo.toISOString())
      .order("viewed_at", { ascending: true });

    if (viewsError) {
      console.error("Error fetching share views:", viewsError.message);
      return c.json({ error: "Failed to fetch analytics" }, 500);
    }

    // Build time series
    const timeSeriesMap = new Map<string, ViewTimeSeriesPoint>();
    (views ?? []).forEach((view) => {
      const date = new Date(view.viewed_at).toISOString().split("T")[0];
      const existing = timeSeriesMap.get(date);
      if (existing) {
        existing.views += 1;
        if (view.is_unique) existing.unique_views += 1;
      } else {
        timeSeriesMap.set(date, {
          date,
          views: 1,
          unique_views: view.is_unique ? 1 : 0,
        });
      }
    });

    const timeSeries = Array.from(timeSeriesMap.values());

    // Get referrer breakdown
    const { data: referrers, error: referrerError } = await supabase
      .from("share_views")
      .select("referrer_source")
      .eq("share_id", share.id)
      .not("referrer_source", "is", null);

    const referrerMap = new Map<string, number>();
    (referrers ?? []).forEach((r) => {
      const source = r.referrer_source ?? "other";
      referrerMap.set(source, (referrerMap.get(source) ?? 0) + 1);
    });

    const referrerBreakdown: ReferrerBreakdown[] = Array.from(
      referrerMap.entries()
    )
      .map(([referrer_source, views]) => ({ referrer_source, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    // Get geo breakdown
    const { data: geoData, error: geoError } = await supabase
      .from("share_views")
      .select("country_code")
      .eq("share_id", share.id)
      .not("country_code", "is", null);

    const geoMap = new Map<string, number>();
    (geoData ?? []).forEach((g) => {
      const country = g.country_code ?? "unknown";
      geoMap.set(country, (geoMap.get(country) ?? 0) + 1);
    });

    const geoBreakdown: GeoBreakdown[] = Array.from(geoMap.entries())
      .map(([country_code, views]) => ({ country_code, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    return c.json({
      share: {
        id: share.id,
        slug: share.slug,
        title: share.title,
        filename: share.filename,
      },
      time_series: timeSeries,
      referrer_breakdown: referrerBreakdown,
      geo_breakdown: geoBreakdown,
    });
  } catch (err) {
    console.error("Unexpected error fetching share analytics:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { analytics };
