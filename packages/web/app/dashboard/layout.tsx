import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { FileText, Heart, User, BarChart3 } from "lucide-react";
import { TeamNav, TeamNavMobile } from "@/components/team-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const navItems = [
    { href: "/dashboard", label: "History", icon: FileText },
    { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/dashboard/favorites", label: "Favorites", icon: Heart },
    { href: "/dashboard/profile", label: "Profile", icon: User },
  ];

  // Fetch user's teams for sidebar nav
  const { data: memberships } = await supabase
    .from("team_members")
    .select("teams(slug, name)")
    .eq("user_id", user.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teams = ((memberships ?? []) as any[]).map((m) => {
    const t = Array.isArray(m.teams) ? m.teams[0] : m.teams;
    return { slug: t?.slug ?? "", name: t?.name ?? "" };
  });

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — nav links only; HeaderBar provides logo + profile */}
      <aside className="hidden md:flex w-56 flex-col border-r border-border bg-card">
        <div className="flex-1 p-3 space-y-1 pt-4">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors duration-200"
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}

          {/* Teams section */}
          <div className="pt-3 mt-3 border-t">
            <p className="px-3 mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Teams
            </p>
            <TeamNav teams={teams} />
          </div>
        </div>
      </aside>

      {/* Mobile nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card">
        <div className="flex justify-around py-2">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
          <TeamNavMobile />
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-4 md:p-6 pb-20 md:pb-6 max-w-[1200px] mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
