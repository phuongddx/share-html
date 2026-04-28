"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ViewTimeSeriesPoint } from "@/types/analytics";

interface AnalyticsViewChartProps {
  data: ViewTimeSeriesPoint[];
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm text-sm">
      <p className="font-medium mb-1">{label ? formatDateLabel(label) : ""}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-muted-foreground">
          {entry.name === "views" ? "Total" : "Unique"}: {entry.value}
        </p>
      ))}
    </div>
  );
}

export function AnalyticsViewChart({ data }: AnalyticsViewChartProps) {
  // Show every 3rd label to avoid overlap
  const tickInterval = Math.max(1, Math.floor(data.length / 8));

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="viewGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(258, 90%, 66%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(258, 90%, 66%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateLabel}
            interval={tickInterval}
            className="text-xs"
            tick={{ fontSize: 12 }}
          />
          <YAxis className="text-xs" tick={{ fontSize: 12 }} />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="views"
            stroke="hsl(258, 90%, 66%)"
            fill="url(#viewGradient)"
            name="views"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="unique_views"
            stroke="hsl(215, 20%, 65%)"
            fill="none"
            name="unique_views"
            strokeWidth={1.5}
            strokeDasharray="5 5"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
