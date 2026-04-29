"use client";

import { useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { NAV_LINKS } from "@/lib/nav-links";
import { useAuthUser } from "@/lib/use-auth-user";
import { createClient } from "@/utils/supabase/client";

interface HeaderMobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function HeaderMobileDrawer({
  open,
  onClose,
}: HeaderMobileDrawerProps) {
  const user = useAuthUser();
  const router = useRouter();
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  // Scroll lock + focus first link when opened
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      const timer = setTimeout(() => firstLinkRef.current?.focus(), 100);
      return () => {
        document.body.style.overflow = "";
        clearTimeout(timer);
      };
    }
    document.body.style.overflow = "";
  }, [open]);

  // Escape key closes drawer
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  const handleSignOut = useCallback(async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      onClose();
      router.push("/");
    } catch (err) {
      console.error("Sign out failed", err);
    }
  }, [onClose, router]);

  return (
    <>
      {/* Backdrop — always rendered, toggle opacity */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 md:hidden transition-opacity duration-200
          ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer panel — always rendered, toggle translate */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`fixed inset-y-0 left-0 z-[60] w-64 bg-background border-r border-border transform transition-transform duration-200 ease-out md:hidden
          ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex flex-col h-full p-4">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map(({ href, label, icon: Icon, authOnly }, i) => {
              if (authOnly && !user) return null;
              return (
                <Link
                  key={href}
                  href={href}
                  ref={i === 0 ? firstLinkRef : undefined}
                  onClick={onClose}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm hover:bg-muted"
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
          {/* Auth section */}
          <div className="border-t mt-4 pt-4">
            {user ? (
              <>
                <Link
                  href="/dashboard/profile"
                  onClick={onClose}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm hover:bg-muted"
                >
                  <User className="size-4" /> Profile
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm hover:bg-muted w-full text-left text-destructive"
                >
                  <LogOut className="size-4" /> Sign Out
                </button>
              </>
            ) : (
              <Link
                href="/auth/login"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm hover:bg-muted"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
