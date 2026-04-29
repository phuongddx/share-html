import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { AnalyticsTopPerformers } from "@/components/analytics/analytics-top-performers";
import { AnalyticsEmptyState } from "@/components/analytics/analytics-empty-state";
import { Eye, Users, TrendingUp, FileText } from "lucide-react";
import type { TopShare } from "@/types/analytics";
import type { Share } from "@/types/share";

export default async function GlobalAnalyticsPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Fetch all user shares for aggregate stats
  const { data: shares } = await supabase
    .from("shares")
    .select("id, view_count")
    .eq("user_id", user.id);

  // Fetch top performing shares via RPC
  const adminClient = createAdminClient();
  const { data: topShares } = await adminClient.rpc("get_user_top_shares", {
    p_user_id: user.id,
    p_limit: 10,
  });

  const shareList = (shares ?? []) as Pick<Share, "id" | "view_count">[];
  const topSharesList = (topShares ?? []) as TopShare[];

  const totalViews = shareList.reduce((sum, s) => sum + s.view_count, 0);
  const totalUniqueViews = topSharesList.reduce((sum, s) => sum + s.unique_views, 0);
  const sharesWithViews = topSharesList.filter((s) => s.total_views > 0).length;
  const avgViewsPerShare = shareList.length > 0
    ? Math.round((totalViews / shareList.length) * 10) / 10
    : 0;

  const hasData = topSharesList.some((s) => s.total_views > 0);

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

      {/* Top performers or empty state */}
      {hasData ? (
        <div className="space-y-4">
          <h2 className="font-mono text-lg font-semibold">Top Performers (30d)</h2>
          <AnalyticsTopPerformers shares={topSharesList} />
        </div>
      ) : (
        <AnalyticsEmptyState />
      )}
    </div>
  );
}
