"use client";

import { useState, type ReactNode } from "react";
import { LuxurySidebar } from "@/modules/dashboard/luxury/components/LuxurySidebar";
import { LuxuryMobileNavigation } from "@/modules/dashboard/luxury/components/LuxuryMobileNavigation";
import { LuxuryTopbar } from "@/modules/dashboard/luxury/components/LuxuryTopbar";

export interface LuxuryBranding {
  logoUrl: string | null;
  brandName: string;
  tagline: string;
  inspirationalMessage: string;
}

interface LuxuryDashboardShellProps {
  branding: LuxuryBranding;
  sidebarFooter: ReactNode;
  /** The per-dashboard action row (date selector, notification/message counts) — data-owned by whichever dashboard aggregator fetched the counts, same slot pattern as `sidebarFooter`. Rendered inside the shell's own persistent `LuxuryTopbar`, alongside the always-present Search/Bloom AI buttons. */
  topbarActions?: ReactNode;
  /** "Final Mobile Visual Refinement" addendum — opt-in (default `"default"`, i.e. today's `p-4`). `"compact"` narrows the mobile-only page gutter to `p-2.5` (10px) so paired mobile cards get closer to the full viewport width; `sm:`/`md:` padding is untouched either way, so tablet/desktop never regress. Only `/team` passes `"compact"` — Founder (`/dashboard`) and the other Team surface never pass it, so their padding is byte-for-byte unchanged. */
  contentPadding?: "default" | "compact";
  children: ReactNode;
}

const MAIN_PADDING_CLASS: Record<"default" | "compact", string> = {
  default: "p-4 sm:p-6 md:p-8",
  compact: "p-2.5 sm:p-6 md:p-8",
};

/**
 * Checkpoint 19, Step 3 — the top-level Luxury Dashboard shell: sidebar
 * (desktop) + mobile drawer + content area, rendered bare (no Classical
 * `Sidebar`/`TopBar`) — `AppShell.tsx` skips its own chrome specifically
 * for `/dashboard` so this never nests inside a second navigation rail.
 * See docs/luxury-design-system.md for the full rationale.
 *
 * App Shell redesign — now also owns a persistent `LuxuryTopbar` row above
 * `children`, matching the target `[ SIDEBAR ] [ TOPBAR ] / [ PAGE CONTENT ]`
 * composition: Search/Bloom AI live here, shared by every Luxury dashboard,
 * instead of each view wiring its own action row inside its own header.
 */
export function LuxuryDashboardShell({ branding, sidebarFooter, topbarActions, contentPadding = "default", children }: LuxuryDashboardShellProps) {
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
        <LuxuryTopbar actions={topbarActions} onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main className={MAIN_PADDING_CLASS[contentPadding]}>{children}</main>
      </div>
    </div>
  );
}
