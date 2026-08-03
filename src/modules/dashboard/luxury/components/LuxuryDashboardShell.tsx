"use client";

import { useState, type ReactNode } from "react";
import { LuxurySidebar } from "@/modules/dashboard/luxury/components/LuxurySidebar";
import { LuxuryMobileNavigation } from "@/modules/dashboard/luxury/components/LuxuryMobileNavigation";
import { MenuIcon } from "@/components/ui/icons";

export interface LuxuryBranding {
  logoUrl: string | null;
  brandName: string;
  tagline: string;
  inspirationalMessage: string;
}

interface LuxuryDashboardShellProps {
  branding: LuxuryBranding;
  sidebarFooter: ReactNode;
  children: ReactNode;
}

/**
 * Checkpoint 19, Step 3 — the top-level Luxury Dashboard shell: sidebar
 * (desktop) + mobile drawer + content area, rendered bare (no Classical
 * `Sidebar`/`TopBar`) — `AppShell.tsx` skips its own chrome specifically
 * for `/dashboard` so this never nests inside a second navigation rail.
 * See docs/luxury-design-system.md for the full rationale.
 */
export function LuxuryDashboardShell({ branding, sidebarFooter, children }: LuxuryDashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-luxury-background">
      <LuxurySidebar
        logoUrl={branding.logoUrl}
        brandName={branding.brandName}
        tagline={branding.tagline}
        inspirationalMessage={branding.inspirationalMessage}
        footer={sidebarFooter}
      />
      <LuxuryMobileNavigation
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        logoUrl={branding.logoUrl}
        brandName={branding.brandName}
        tagline={branding.tagline}
        footer={sidebarFooter}
      />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation menu"
          className="mx-4 mt-4 flex h-10 w-10 items-center justify-center rounded-full bg-luxury-surface text-luxury-text shadow-luxury-sm md:hidden"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
        <main className="p-4 sm:p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
