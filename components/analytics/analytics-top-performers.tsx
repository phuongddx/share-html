"use client";

import Link from "next/link";
import { Eye, Users } from "lucide-react";
import type { TopShare } from "@/types/analytics";

interface AnalyticsTopPerformersProps {
  shares: TopShare[];
}

export function AnalyticsTopPerformers({ shares }: AnalyticsTopPerformersProps) {
  if (shares.length === 0) return null;

  return (
    <div className="rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Title</th>
              <th className="text-right p-3 font-medium">
                <span className="inline-flex items-center gap-1">
                  <Eye className="size-3" /> Total
                </span>
              </th>
              <th className="text-right p-3 font-medium">
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3" /> Unique
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shares.map((share) => (
              <tr key={share.share_id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-3">
                  <Link
                    href={`/dashboard/analytics/${share.slug}`}
                    className="font-medium hover:underline truncate block max-w-[200px]"
                  >
                    {share.title}
                  </Link>
                  <span className="text-xs text-muted-foreground">/{share.slug}</span>
                </td>
                <td className="p-3 text-right tabular-nums">{share.total_views.toLocaleString()}</td>
                <td className="p-3 text-right tabular-nums">{share.unique_views.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
