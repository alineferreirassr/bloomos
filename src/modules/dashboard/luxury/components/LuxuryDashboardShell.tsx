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

// GLOBAL-VISUAL-08 — bottom padding reserves safe-area space for
// CopilotLauncher's global mobile FAB (`fixed right-4 bottom-4 h-14 w-14`,
// hidden at `md:` and up — this shell renders it too, per its own doc
// comment). Written with explicit px/pt/pb longhands at every breakpoint
// rather than the `p-4 sm:p-6 md:p-8` shorthand it replaces, so there's no
// shorthand-vs-longhand cascade ambiguity between the base padding and the
// pb-24 override (the same class of bug already caught once this
// checkpoint in Button.tsx's border-color conflict) — px/pt values are
// otherwise byte-identical to the original.
const MAIN_PADDING_CLASS: Record<"default" | "compact", string> = {
  default: "px-4 pt-4 pb-24 sm:px-6 sm:pt-6 sm:pb-24 md:px-8 md:pt-8 md:pb-8",
  compact: "px-2.5 pt-2.5 pb-24 sm:px-6 sm:pt-6 sm:pb-24 md:px-8 md:pt-8 md:pb-8",
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
