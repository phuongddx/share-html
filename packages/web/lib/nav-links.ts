import { type LucideIcon, Home, FileEdit, Search, LayoutDashboard } from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  iconOnly?: boolean;
  authOnly?: boolean;
}

export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/editor", label: "Editor", icon: FileEdit },
  { href: "/search", label: "Search", icon: Search },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, authOnly: true },
];
