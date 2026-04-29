"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { HeaderNav } from "@/components/header-nav";
import { HeaderMobileDrawer } from "@/components/header-mobile-drawer";
import { AuthUserMenu } from "@/components/auth-user-menu";

export function HeaderBar() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-between h-14 px-6 max-w-[1200px] mx-auto">
          {/* Left: hamburger (mobile) + logo */}
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-1 hover:bg-muted rounded-md text-foreground"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu className="size-5" />
            </button>
            <Link
              href="/"
              className="font-mono text-lg font-bold tracking-tight"
            >
              <span className="text-muted-foreground">&gt;</span>{" "}
              <span className="text-primary">dropitx</span>
            </Link>
          </div>
          {/* Center: desktop nav */}
          <HeaderNav />
          {/* Right: auth */}
          <AuthUserMenu />
        </div>
      </header>
      {/* Mobile drawer */}
      <HeaderMobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}
