import Link from "next/link";
import { Users, Plus } from "lucide-react";

interface TeamNavItem {
  slug: string;
  name: string;
}

interface TeamNavProps {
  teams: TeamNavItem[];
}

/** Sidebar team section — renders team links + create button. */
export function TeamNav({ teams }: TeamNavProps) {
  if (teams.length === 0) {
    return (
      <Link
        href="/dashboard/teams/new"
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors text-muted-foreground"
      >
        <Plus className="size-4" />
        Create Team
      </Link>
    );
  }

  return (
    <div className="space-y-1">
      {teams.map((t) => (
        <Link
          key={t.slug}
          href={`/dashboard/teams/${t.slug}`}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
        >
          <Users className="size-4" />
          <span className="truncate">{t.name}</span>
        </Link>
      ))}
      <Link
        href="/dashboard/teams/new"
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors text-muted-foreground"
      >
        <Plus className="size-4" />
        Create Team
      </Link>
    </div>
  );
}

/** Mobile team nav — single link to teams list page (no per-team links). */
export function TeamNavMobile() {
  return (
    <Link
      href="/dashboard/teams"
      className="flex flex-col items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      <Users className="size-4" />
      Teams
    </Link>
  );
}
