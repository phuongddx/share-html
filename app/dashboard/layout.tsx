import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { FileText, Heart, User } from "lucide-react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const navItems = [
    { href: "/dashboard", label: "History", icon: FileText },
    { href: "/dashboard/favorites", label: "Favorites", icon: Heart },
    { href: "/dashboard/profile", label: "Profile", icon: User },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden md:flex w-56 flex-col border-r bg-card">
        <div className="p-4 border-b">
          <Link href="/" className="font-mono text-lg font-bold tracking-tight">
            [x]{" "}<span className="text-violet-600 dark:text-violet-400">dropitx</span>
          </Link>
        </div>

        <div className="flex-1 p-3 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </div>

        <div className="p-3 border-t">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="size-8 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="size-8 rounded-full bg-violet-600 flex items-center justify-center text-white text-xs font-bold">
                {(profile?.display_name || user.email || "U")[0].toUpperCase()}
              </div>
            )}
            <span className="text-sm truncate">
              {profile?.display_name || user.email}
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-card">
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
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-4 md:p-6 max-w-4xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
