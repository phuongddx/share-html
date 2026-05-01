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
import { useTheme } from "next-themes";
import type { ReferrerBreakdown } from "@dropitx/shared/types/analytics";

interface AnalyticsReferrerChartProps {
  data: ReferrerBreakdown[];
}

const SOURCE_COLORS_LIGHT: Record<string, string> = {
  direct: '#71717A',
  google: '#7C3AED',
  twitter: '#4F46E5',
  slack: '#059669',
  discord: '#8B5CF6',
  github: '#52525B',
  embed: '#D97706',
  other: '#A1A1AA',
};

const SOURCE_COLORS_DARK: Record<string, string> = {
  direct: '#A1A1AA',
  google: '#A78BFA',
  twitter: '#818CF8',
  slack: '#34D399',
  discord: '#C4B5FD',
  github: '#A1A1AA',
  embed: '#FBBF24',
  other: '#D4D4D8',
};

function CustomTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: ReferrerBreakdown }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-popover p-3 text-sm">
      <p className="font-medium capitalize">{item.referrer_source}</p>
      <p className="text-muted-foreground">{item.views} views</p>
    </div>
  );
}

export function AnalyticsReferrerChart({ data }: AnalyticsReferrerChartProps) {
  const isDark = useTheme().theme === "dark";
  const sourceColors = isDark ? SOURCE_COLORS_DARK : SOURCE_COLORS_LIGHT;

  const topData = data.slice(0, 6);

  return (
    <div className="w-full h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={topData} layout="vertical" margin={{ top: 5, right: 20, left: 60, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
          <XAxis type="number" className="text-muted-foreground text-xs" tick={{ fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="referrer_source"
            className="text-muted-foreground text-xs"
            tick={{ fontSize: 12 }}
            tickFormatter={(v: string) => v.charAt(0).toUpperCase() + v.slice(1)}
            width={55}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="views" radius={[0, 4, 4, 0]}>
            {topData.map((entry) => (
              <Cell
                key={entry.referrer_source}
                fill={sourceColors[entry.referrer_source] ?? sourceColors.other}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
