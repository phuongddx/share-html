import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Plus, Clock } from "lucide-react";
import type { TeamRole } from "@/types/team";

interface TeamWithRole {
  id: string;
  name: string;
  slug: string;
  created_by: string;
  plan: string;
  created_at: string;
  role: TeamRole;
}

const ROLE_COLORS: Record<TeamRole, "default" | "secondary" | "outline"> = {
  owner: "default",
  editor: "secondary",
  viewer: "outline",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function TeamsPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: memberships, error: membersError } = await supabase
    .from("team_members")
    .select("role, teams(id, name, slug, created_by, plan, created_at)")
    .eq("user_id", user.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teams: TeamWithRole[] = ((memberships ?? []) as any[]).map((m) => {
    const t = Array.isArray(m.teams) ? m.teams[0] : m.teams;
    return {
      id: t?.id ?? "",
      name: t?.name ?? "",
      slug: t?.slug ?? "",
      created_by: t?.created_by ?? "",
      plan: t?.plan ?? "free",
      created_at: t?.created_at ?? "",
      role: m.role as TeamRole,
    };
  });

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div className="flex items-center justify-between">
        <h1 className="font-mono text-lg font-semibold">Teams</h1>
        <Link href="/dashboard/teams/new">
          <Button size="sm">
            <Plus className="size-4" />
            Create Team
          </Button>
        </Link>
      </div>

      {teams.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="size-12 mx-auto mb-3 opacity-50" />
          <p>No teams yet. Create one to collaborate with others.</p>
          <Link href="/dashboard/teams/new" className="mt-4 inline-block">
            <Button variant="outline" size="sm">
              <Plus className="size-4" />
              Create Your First Team
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {teams.map((team) => (
            <Link key={team.id} href={`/dashboard/teams/${team.slug}`}>
              <Card className="border border-border rounded-lg transition-colors duration-200 cursor-pointer">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="size-5 text-primary shrink-0" />
                    <p className="font-medium truncate flex-1">{team.name}</p>
                    <Badge variant={ROLE_COLORS[team.role]} className="shrink-0 text-xs">
                      {team.role}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      Created {formatDate(team.created_at)}
                    </span>
                    <Badge variant="ghost" className="text-xs">
                      {team.plan}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
