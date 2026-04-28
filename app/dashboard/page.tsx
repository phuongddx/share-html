import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { DashboardShareList } from "@/components/dashboard-share-list";
import { FileText, Eye, HardDrive } from "lucide-react";
import type { Share } from "@/types/share";

export type ShareWithPasswordFlag = Omit<Share, "password_hash"> & { has_password: boolean };

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Personal shares
  const { data: shares } = await supabase
    .from("shares")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Strip password_hash from client data; expose only a boolean flag
  const shareList: ShareWithPasswordFlag[] = (shares ?? []).map((s: Share) => {
    const { password_hash, ...rest } = s;
    return { ...rest, has_password: !!password_hash };
  });
  const totalShares = shareList.length;
  const totalViews = shareList.reduce((sum, s) => sum + s.view_count, 0);
  const totalSize = shareList.reduce((sum, s) => sum + (s.file_size ?? 0), 0);

  // Fetch user's team memberships for filter
  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id, teams(slug, name)")
    .eq("user_id", user.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teams = ((memberships ?? []) as any[]).map((m) => {
    const t = Array.isArray(m.teams) ? m.teams[0] : m.teams;
    return { id: m.team_id as string, slug: t?.slug ?? "", name: t?.name ?? "" };
  });

  // Fetch team shares for all teams in parallel (avoids N+1)
  const teamShareQueries = teams.map(async (team) => {
    const { data: teamShares } = await supabase
      .from("team_shares")
      .select("created_at, shared_by, shares(id, slug, filename, title, mime_type, view_count, file_size, created_at)")
      .eq("team_id", team.id)
      .order("created_at", { ascending: false });
    return { slug: team.slug, shares: teamShares ?? [] };
  });
  const teamShareResults = await Promise.all(teamShareQueries);

  const teamShareMap: Record<string, unknown[]> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const { slug, shares } of teamShareResults) {
    teamShareMap[slug] = shares as any[];
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats — always show personal share stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <FileText className="size-4" />
            Shares
          </div>
          <p className="text-2xl font-bold mt-1">{totalShares}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Eye className="size-4" />
            Views
          </div>
          <p className="text-2xl font-bold mt-1">{totalViews}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <HardDrive className="size-4" />
            Storage
          </div>
          <p className="text-2xl font-bold mt-1">{formatFileSize(totalSize)}</p>
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
