"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { ReferrerBreakdown } from "@/types/analytics";

interface AnalyticsReferrerChartProps {
  data: ReferrerBreakdown[];
}

const SOURCE_COLORS: Record<string, string> = {
  direct: "hsl(215, 20%, 55%)",
  google: "hsl(258, 90%, 66%)",
  twitter: "hsl(200, 90%, 50%)",
  slack: "hsl(150, 60%, 45%)",
  discord: "hsl(260, 70%, 60%)",
  github: "hsl(220, 15%, 45%)",
  embed: "hsl(30, 90%, 55%)",
  other: "hsl(0, 0%, 65%)",
};

function CustomTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: ReferrerBreakdown }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm text-sm">
      <p className="font-medium capitalize">{item.referrer_source}</p>
      <p className="text-muted-foreground">{item.views} views</p>
    </div>
  );
}

export function AnalyticsReferrerChart({ data }: AnalyticsReferrerChartProps) {
  const topData = data.slice(0, 6);

  return (
    <div className="w-full h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={topData} layout="vertical" margin={{ top: 5, right: 20, left: 60, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="referrer_source"
            tick={{ fontSize: 12 }}
            tickFormatter={(v: string) => v.charAt(0).toUpperCase() + v.slice(1)}
            width={55}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="views" radius={[0, 4, 4, 0]}>
            {topData.map((entry) => (
              <Cell
                key={entry.referrer_source}
                fill={SOURCE_COLORS[entry.referrer_source] ?? SOURCE_COLORS.other}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
