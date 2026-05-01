import { AnalyticsEmptyState } from "@/components/analytics/analytics-empty-state";
import { Eye, Users, TrendingUp, FileText } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { ShareAnalytics } from "@dropitx/shared/types/analytics";

export default async function GlobalAnalyticsPage() {
  const analytics = await apiClient<ShareAnalytics>("/dashboard/analytics");

  const totalViews = analytics.total_views;
  const totalUniqueViews = analytics.unique_views;
  const sharesWithViews = totalViews > 0 ? 1 : 0; // Simplified
  const avgViewsPerShare = analytics.avg_daily_views;

  const hasData = totalViews > 0;

  return (
    <div className="space-y-6">
      <h1 className="font-mono text-lg font-semibold">Analytics</h1>

      {/* Overview stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Eye className="size-4" />
            Total Views
          </div>
          <p className="font-mono text-3xl font-bold mt-1">{totalViews.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Users className="size-4" />
            Unique Visitors
          </div>
          <p className="font-mono text-3xl font-bold mt-1">{totalUniqueViews.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <FileText className="size-4" />
            Shares with Views
          </div>
          <p className="font-mono text-3xl font-bold mt-1">{sharesWithViews}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <TrendingUp className="size-4" />
            Avg Views/Share
          </div>
          <p className="font-mono text-3xl font-bold mt-1">{avgViewsPerShare}</p>
        </div>
      </div>

      {!hasData && <AnalyticsEmptyState />}
    </div>
  );
}
