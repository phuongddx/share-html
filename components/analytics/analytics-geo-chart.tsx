"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { PieLabelRenderProps } from "recharts";
import type { GeoBreakdown } from "@/types/analytics";

interface AnalyticsGeoChartProps {
  data: GeoBreakdown[];
}

const PALETTE = [
  "hsl(258, 90%, 66%)",
  "hsl(200, 90%, 50%)",
  "hsl(150, 60%, 45%)",
  "hsl(30, 90%, 55%)",
  "hsl(260, 70%, 60%)",
  "hsl(0, 70%, 55%)",
  "hsl(45, 80%, 50%)",
  "hsl(180, 60%, 45%)",
];

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", GB: "United Kingdom", DE: "Germany", FR: "France",
  JP: "Japan", KR: "South Korea", IN: "India", BR: "Brazil", CA: "Canada",
  AU: "Australia", NL: "Netherlands", SG: "Singapore", VN: "Vietnam",
  PH: "Philippines", MX: "Mexico", IT: "Italy", ES: "Spain",
};

function CustomTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: GeoBreakdown }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  const name = COUNTRY_NAMES[item.country_code] ?? item.country_code;
  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm text-sm">
      <p className="font-medium">{name}</p>
      <p className="text-muted-foreground">{item.views} views</p>
    </div>
  );
}

export function AnalyticsGeoChart({ data }: AnalyticsGeoChartProps) {
  // Bucket small countries into "Other"
  const top = data.slice(0, 8);
  const otherViews = data.slice(8).reduce((sum, d) => sum + d.views, 0);
  const chartData = otherViews > 0
    ? [...top, { country_code: "Other", views: otherViews }]
    : top;

  const total = chartData.reduce((sum, d) => sum + d.views, 0);

  return (
    <div className="w-full h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="views"
            nameKey="country_code"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={(props: PieLabelRenderProps) => {
              // recharts passes data entry fields alongside label props
              const entry = props as PieLabelRenderProps & GeoBreakdown;
              const cc = entry.country_code ?? String(props.name ?? "");
              const views = entry.views ?? Number(props.value ?? 0);
              const pct = total > 0 ? Math.round((views / total) * 100) : 0;
              return `${cc} ${pct}%`;
            }}
            labelLine={false}
            fontSize={11}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
