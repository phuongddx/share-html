import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { AnalyticsStatsCards } from "@/components/analytics/analytics-stats-cards";
import { AnalyticsViewChart } from "@/components/analytics/analytics-view-chart";
import { AnalyticsReferrerChart } from "@/components/analytics/analytics-referrer-chart";
import { AnalyticsGeoChart } from "@/components/analytics/analytics-geo-chart";
import { AnalyticsEmptyState } from "@/components/analytics/analytics-empty-state";
import { ArrowLeft, Link as LinkIcon, Copy } from "lucide-react";
import type { ShareAnalytics, ViewTimeSeriesPoint, ReferrerBreakdown, GeoBreakdown } from "@/types/analytics";

interface PerShareAnalyticsPageProps {
  params: Promise<{ slug: string }>;
}

const EMPTY_ANALYTICS: ShareAnalytics = {
  total_views: 0,
  unique_views: 0,
  views_today: 0,
  views_7d: 0,
  avg_daily_views: 0,
};

export default async function PerShareAnalyticsPage({ params }: PerShareAnalyticsPageProps) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Verify ownership server-side — no client-supplied userId
  const { data: share } = await supabase
    .from("shares")
    .select("id, user_id, slug, title, filename")
    .eq("slug", slug)
    .eq("user_id", user.id)
    .single();

  if (!share) notFound();

  // Fetch all aggregated data in parallel via direct RPCs (no API route)
  const adminClient = createAdminClient();
  const [analyticsRes, timeseriesRes, referrersRes, geoRes] = await Promise.all([
    adminClient.rpc("get_share_analytics", { p_share_id: share.id, p_days: 30 }),
    adminClient.rpc("get_share_view_timeseries", { p_share_id: share.id, p_days: 30 }),
    adminClient.rpc("get_share_referrers", { p_share_id: share.id, p_days: 30 }),
    adminClient.rpc("get_share_geo", { p_share_id: share.id, p_days: 30 }),
  ]);

  const analytics: ShareAnalytics = (analyticsRes.data as ShareAnalytics[])?.[0] ?? EMPTY_ANALYTICS;
  const timeseries: ViewTimeSeriesPoint[] = (timeseriesRes.data as ViewTimeSeriesPoint[]) ?? [];
  const referrers: ReferrerBreakdown[] = (referrersRes.data as ReferrerBreakdown[]) ?? [];
  const geo: GeoBreakdown[] = (geoRes.data as GeoBreakdown[]) ?? [];

  const title = share.title ?? share.filename;
  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://dropitx.com"}/s/${share.slug}`;
  const hasData = analytics.total_views > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/analytics"
          className="rounded-lg p-2 hover:bg-muted transition-colors"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate font-mono">{title}</h1>
          <p className="text-sm text-muted-foreground">/{share.slug}</p>
        </div>
      </div>

      {/* Share URL quick copy */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
        <LinkIcon className="size-4 text-muted-foreground shrink-0" />
        <span className="text-sm truncate flex-1">{shareUrl}</span>
        <button
          className="copy-url-btn rounded-md p-1.5 hover:bg-muted transition-colors"
          data-url={shareUrl}
          title="Copy link"
        >
          <Copy className="size-4" />
        </button>
      </div>

      {hasData ? (
        <>
          {/* Stats cards */}
          <AnalyticsStatsCards analytics={analytics} />

          {/* Views over time */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-mono text-sm font-semibold mb-4">Views Over Time (30d)</h2>
            <AnalyticsViewChart data={timeseries} />
          </div>

          {/* Two-column: Referrers + Geo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="font-mono text-sm font-semibold mb-4">Traffic Sources</h2>
              {referrers.length > 0 ? (
                <AnalyticsReferrerChart data={referrers} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No referrer data</p>
              )}
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="font-mono text-sm font-semibold mb-4">Geography</h2>
              {geo.length > 0 ? (
                <AnalyticsGeoChart data={geo} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No geo data</p>
              )}
            </div>
          </div>
        </>
      ) : (
        <AnalyticsEmptyState />
      )}
    </div>
  );
}
