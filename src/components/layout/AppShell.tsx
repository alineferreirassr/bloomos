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
        {/* GLOBAL-VISUAL-03B.2 — gutter ported to AF Digital Studio OS's own
            real shell padding (`px-5 py-8 sm:px-8`, app/(app)/_shell/app-shell.tsx,
            HEAD 1587d1f). Dashboard/Team render their own LuxuryDashboardShell,
            unaffected. GLOBAL-VISUAL-08 — `pb-24 md:pb-8` reserves safe-area
            space for CopilotLauncher's global mobile FAB (`fixed right-4
            bottom-4 h-14 w-14`, hidden at `md:` and up, same breakpoint used
            here), a real, confirmed overlap: without this reserve, whatever
            content a given page happens to end with sits directly under the
            56px button on every mobile route, since the FAB is mounted once
            at the layout level, outside any single page's control. Fixed
            once at the shared shell rather than padding every page. */}
        <main className="flex-1 overflow-y-auto px-5 pt-8 pb-24 sm:px-8 md:pb-8">{children}</main>
      </div>
    </div>
  );
}
