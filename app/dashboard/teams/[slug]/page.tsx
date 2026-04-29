import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, FileText, Eye, Settings, UserPlus, ArrowLeft } from "lucide-react";
import { TeamShareCard } from "@/components/team-share-card";

const ROLE_COLORS: Record<string, "default" | "secondary" | "outline"> = {
  owner: "default",
  editor: "secondary",
  viewer: "outline",
};

export default async function TeamOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Fetch team
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!team) redirect("/dashboard/teams");

  // Verify membership
  const { data: membership, error: memberError } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", team.id)
    .eq("user_id", user.id)
    .single();

  if (!membership) redirect("/dashboard/teams");

  const userRole = String(membership.role);

  // Fetch team shares — Supabase returns shares as nested array from join
  const { data: teamShareRows } = await supabase
    .from("team_shares")
    .select("created_at, shared_by, shares(id, slug, filename, title, mime_type, view_count, file_size, created_at)")
    .eq("team_id", team.id)
    .order("created_at", { ascending: false });

  // Flatten Supabase join rows: `shares` is an array from the join
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const validShares = ((teamShareRows ?? []) as any[])
    .map((row) => {
      const sharesArr = Array.isArray(row.shares) ? row.shares : row.shares ? [row.shares] : [];
      if (sharesArr.length === 0) return null;
      return { created_at: row.created_at, shared_by: row.shared_by, share: sharesArr[0] };
    })
    .filter(Boolean);

  // Count members
  const { count: memberCount } = await supabase
    .from("team_members")
    .select("*", { count: "exact", head: true })
    .eq("team_id", team.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalViews = validShares.reduce((sum: number, r: any) => sum + (r.share?.view_count ?? 0), 0);

  const isOwnerOrEditor = userRole === "owner" || userRole === "editor";

  return (
    <div className="space-y-6 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/dashboard/teams"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="size-3" />
            Back to Teams
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-lg font-semibold">{team.name}</h1>
            <Badge variant={ROLE_COLORS[userRole] ?? "outline"}>{userRole}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {team.slug} · {team.plan} plan
          </p>
        </div>
        <div className="flex gap-2">
          {isOwnerOrEditor && (
            <Link href={`/dashboard/teams/${slug}/members`}>
              <Button variant="outline" size="sm">
                <UserPlus className="size-4" />
                Members
              </Button>
            </Link>
          )}
          {userRole === "owner" && (
            <Link href={`/dashboard/teams/${slug}/settings`}>
              <Button variant="outline" size="sm">
                <Settings className="size-4" />
                Settings
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <FileText className="size-4" />
            Shares
          </div>
          <p className="text-2xl font-bold mt-1">{validShares.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Eye className="size-4" />
            Views
          </div>
          <p className="text-2xl font-bold mt-1">{totalViews}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Users className="size-4" />
            Members
          </div>
          <p className="text-2xl font-bold mt-1">{memberCount ?? 0}</p>
        </div>
      </div>

      {/* Shares list */}
      {validShares.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="size-12 mx-auto mb-3 opacity-50" />
          <p>No shares in this team yet.</p>
          {isOwnerOrEditor && (
            <p className="text-xs mt-1">Use the API with a team API key to create team shares.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {validShares.map((row: any) => (
            <TeamShareCard
              key={row.share.id}
              share={row.share as never}
              teamName={team.name}
            />
          ))}
        </div>
      )}
    </div>
  );
}
