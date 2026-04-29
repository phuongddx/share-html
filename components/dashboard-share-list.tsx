"use client";

import { useState } from "react";
import { DashboardShareCard } from "@/components/dashboard-share-card";
import { TeamShareCard } from "@/components/team-share-card";
import { FileText } from "lucide-react";
import type { Share } from "@/types/share";

export type ShareWithPasswordFlag = Omit<Share, "password_hash"> & {
  has_password: boolean;
};

interface TeamOption {
  slug: string;
  name: string;
}

interface TeamShareItem {
  created_at: string;
  shared_by: string;
  shares: {
    id: string;
    slug: string;
    filename: string;
    title: string | null;
    mime_type: string;
    view_count: number;
    file_size: number | null;
    created_at: string;
  } | null;
}

interface DashboardShareListProps {
  personalShares: ShareWithPasswordFlag[];
  teams: TeamOption[];
  teamShareMap: Record<string, TeamShareItem[]>;
}

export function DashboardShareList({
  personalShares,
  teams,
  teamShareMap,
}: DashboardShareListProps) {
  const [filter, setFilter] = useState<string>("personal");

  return (
    <div className="space-y-6">
      {/* Filter dropdown */}
      {teams.length > 0 && (
        <div className="flex items-center gap-2">
          <label htmlFor="team-filter" className="text-sm font-medium">
            Showing:
          </label>
          <select
            id="team-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="personal">Personal</option>
            {teams.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Share list */}
      {filter === "personal" ? (
        personalShares.length === 0 ? (
          <EmptyState message="No shares yet. Upload a file to get started." />
        ) : (
          <div className="space-y-3">
            {personalShares.map((share) => (
              <DashboardShareCard key={share.id} share={share} />
            ))}
          </div>
        )
      ) : (
        <>
          {(() => {
            const teamShares = teamShareMap[filter] ?? [];
            const valid = teamShares.filter((r) => r.shares !== null);
            if (valid.length === 0) {
              return (
                <EmptyState message="No shares in this team yet." />
              );
            }
            return (
              <div className="space-y-3">
                {valid.map((row) => (
                  <TeamShareCard
                    key={row.shares!.id}
                    share={row.shares! as never}
                    teamName={teams.find((t) => t.slug === filter)?.name ?? ""}
                  />
                ))}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <FileText className="size-12 mx-auto mb-3 opacity-50" />
      <p>{message}</p>
    </div>
  );
}
