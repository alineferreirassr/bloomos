"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { MobileNav } from "@/components/layout/MobileNav";

interface AppShellProps {
  children: ReactNode;
  workspaceDisplayName: string;
}

/**
 * Checkpoint 19 — `/dashboard` renders its own full-page Luxury Dashboard
 * shell (`LuxuryDashboardShell`: its own sidebar, its own mobile nav) that
 * fully replaces this Classical Sidebar/TopBar/MobileNav, matching the
 * three approved reference images exactly (no second navigation rail, no
 * breadcrumb bar layered above it). Every other route keeps this Classical
 * shell completely unchanged — a full application re-skin is this
 * checkpoint's own explicit Non-Goal. See docs/luxury-design-system.md.
 *
 * "Team page must use the same dashboard system" addendum — `/team`
 * (`TeamView.tsx`) joins `/dashboard` here for the same reason: it now
 * renders its own `LuxuryDashboardShell` too, so it must not also get this
 * Classical shell layered underneath it.
 */
const LUXURY_SHELL_ROUTES = ["/dashboard", "/team"];

export function AppShell({ children, workspaceDisplayName }: AppShellProps) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (LUXURY_SHELL_ROUTES.includes(pathname)) {
    return <div className="min-h-screen bg-luxury-background">{children}</div>;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar workspaceDisplayName={workspaceDisplayName} />
      <MobileNav
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        workspaceDisplayName={workspaceDisplayName}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-7">{children}</main>
      </div>
    </div>
  );
}
