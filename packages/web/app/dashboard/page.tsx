import { redirect } from "next/navigation";
import { DashboardShareList } from "@/components/dashboard-share-list";
import { FileText, Eye, HardDrive } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { ShareWithPasswordFlag, Share } from "@dropitx/shared/types/share";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function DashboardPage() {
  // Fetch personal shares from API
  const shareList = await apiClient<ShareWithPasswordFlag[]>("/dashboard/shares");
  const totalShares = shareList.length;
  const totalViews = shareList.reduce((sum, s) => sum + s.view_count, 0);
  const totalSize = shareList.reduce((sum, s) => sum + (s.file_size ?? 0), 0);

  // Fetch user's teams from API
  const { teams } = await apiClient<{ teams: Array<{ id: string; slug: string; name: string; role: string }> }>("/dashboard/teams");

  // Fetch team shares for all teams in parallel (avoids N+1)
  const teamShareQueries = teams.map(async (team) => {
    try {
      const teamShares = await apiClient<
        Array<{
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
        }>
      >(`/dashboard/teams/${team.slug}/shares`);
      return { slug: team.slug, shares: teamShares };
    } catch (error) {
      console.error(`Failed to fetch shares for team ${team.slug}:`, error);
      return { slug: team.slug, shares: [] };
    }
  });
  const teamShareResults = await Promise.all(teamShareQueries);

  const teamShareMap: Record<string, unknown[]> = {};
  for (const { slug, shares } of teamShareResults) {
    teamShareMap[slug] = shares as unknown[];
  }

  return (
    <div className="space-y-6">
      <h1 className="font-mono text-lg font-semibold">Dashboard</h1>

      {/* Stats — always show personal share stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <FileText className="size-4" />
            Shares
          </div>
          <p className="font-mono text-3xl font-bold mt-1">{totalShares}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Eye className="size-4" />
            Views
          </div>
          <p className="font-mono text-3xl font-bold mt-1">{totalViews}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <HardDrive className="size-4" />
            Storage
          </div>
          <p className="font-mono text-3xl font-bold mt-1">{formatFileSize(totalSize)}</p>
        </div>
      </div>

      {/* Share list with team filter */}
      <DashboardShareList
        personalShares={shareList}
        teams={teams.map((t) => ({ slug: t.slug, name: t.name }))}
        teamShareMap={teamShareMap as Record<string, { created_at: string; shared_by: string; shares: { id: string; slug: string; filename: string; title: string | null; mime_type: string; view_count: number; file_size: number | null; created_at: string } | null }[]>}
      />
    </div>
  );
}
