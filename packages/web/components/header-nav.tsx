"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS } from "@/lib/nav-links";
import { useAuthUser } from "@/lib/use-auth-user";

export function HeaderNav() {
  const pathname = usePathname();
  const user = useAuthUser();

  return (
    <nav
      className="hidden md:flex items-center gap-1"
      aria-label="Main navigation"
    >
      {NAV_LINKS.map(({ href, label, icon: Icon, iconOnly, authOnly }) => {
        if (authOnly && !user) return null;
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200
              ${
                isActive
                  ? "text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
          >
            <Icon className="size-4" />
            {!iconOnly && label}
          </Link>
        );
      })}
    </nav>
  );
}
