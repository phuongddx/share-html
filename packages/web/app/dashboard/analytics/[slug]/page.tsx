import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { AnalyticsStatsCards } from "@/components/analytics/analytics-stats-cards";
import { AnalyticsViewChart } from "@/components/analytics/analytics-view-chart";
import { AnalyticsReferrerChart } from "@/components/analytics/analytics-referrer-chart";
import { AnalyticsGeoChart } from "@/components/analytics/analytics-geo-chart";
import { AnalyticsEmptyState } from "@/components/analytics/analytics-empty-state";
import { ArrowLeft, Link as LinkIcon, Copy } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { ShareAnalytics, ViewTimeSeriesPoint, ReferrerBreakdown, GeoBreakdown } from "@dropitx/shared/types/analytics";
import type { Share } from "@dropitx/shared/types/share";

interface PerShareAnalyticsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function PerShareAnalyticsPage({ params }: PerShareAnalyticsPageProps) {
  const { slug } = await params;

  // Fetch share analytics from API (includes share details)
  const analyticsData = await apiClient<{
    share: {
      id: string;
      slug: string;
      title: string | null;
      filename: string;
    };
    time_series: ViewTimeSeriesPoint[];
    referrer_breakdown: ReferrerBreakdown[];
    geo_breakdown: GeoBreakdown[];
  }>(`/dashboard/analytics/${slug}`).catch(() => null);

  if (!analyticsData) notFound();

  const { share, time_series: timeseries, referrer_breakdown: referrers, geo_breakdown: geo } = analyticsData;

  const title = share.title ?? share.filename;
  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://dropitx.com"}/s/${share.slug}`;
  const hasData = timeseries.length > 0;

  // Compute analytics from time series
  const analytics: ShareAnalytics = {
    total_views: timeseries.reduce((sum, t) => sum + t.views, 0),
    unique_views: timeseries.reduce((sum, t) => sum + t.unique_views, 0),
    views_today: 0,
    views_7d: 0,
    avg_daily_views: timeseries.length > 0
      ? Math.round(timeseries.reduce((sum, t) => sum + t.views, 0) / timeseries.length)
      : 0,
  };

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
