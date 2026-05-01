"use client";

import { Eye, Users, Calendar, TrendingUp } from "lucide-react";
import type { ShareAnalytics } from "@dropitx/shared/types/analytics";

interface AnalyticsStatsCardsProps {
  analytics: ShareAnalytics;
}

export function AnalyticsStatsCards({ analytics }: AnalyticsStatsCardsProps) {
  const uniqueRate = analytics.total_views > 0
    ? Math.round((analytics.unique_views / analytics.total_views) * 100)
    : 0;

  const cards = [
    {
      label: "Total Views",
      value: analytics.total_views.toLocaleString(),
      icon: Eye,
    },
    {
      label: "Unique Visitors",
      value: analytics.unique_views.toLocaleString(),
      sub: `${uniqueRate}% unique rate`,
      icon: Users,
    },
    {
      label: "Views Today",
      value: analytics.views_today.toLocaleString(),
      icon: Calendar,
    },
    {
      label: "Avg Daily",
      value: analytics.avg_daily_views.toLocaleString(),
      sub: `Last 7d: ${analytics.views_7d.toLocaleString()}`,
      icon: TrendingUp,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(({ label, value, sub, icon: Icon }) => (
        <div key={label} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Icon className="size-4" />
            {label}
          </div>
          <p className="font-mono text-3xl font-bold mt-1">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
      ))}
    </div>
  );
}
