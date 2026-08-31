"use client";

import { useState, type ReactNode } from "react";
import { LuxuryClientSidebar } from "@/modules/dashboard/luxury/components/LuxuryClientSidebar";
import { LuxuryClientMobileNavigation } from "@/modules/dashboard/luxury/components/LuxuryClientMobileNavigation";
import { MenuIcon } from "@/components/ui/icons";

interface LuxuryClientDashboardShellProps {
  logoUrl: string | null;
  brandName: string;
  sidebarFooter: ReactNode;
  /** "Final Mobile Visual Refinement" addendum — opt-in (default `"default"`, i.e. today's `p-4`). `"compact"` narrows the mobile-only page gutter to `p-2.5` (10px); `sm:`/`md:` padding is untouched, so tablet/desktop never regress. Only the Portal Home dashboard (`ClientDashboardView`) passes `"compact"` — every other Client Portal page (contracts, documents, ...) keeps today's padding unchanged. */
  contentPadding?: "default" | "compact";
  children: ReactNode;
}

const MAIN_PADDING_CLASS: Record<"default" | "compact", string> = {
  default: "p-4 sm:p-6 md:p-8",
  compact: "p-2.5 sm:p-6 md:p-8",
};

/** Checkpoint 19, Step 9 — the Client Dashboard's own top-level shell, mirroring `LuxuryDashboardShell`'s exact structure with the Client Portal's own sidebar/mobile nav. Rendered bare — `ClientPortalShell` skips its own top-nav chrome specifically for `/client-access`, the same seam `AppShell` already handles for `/dashboard`. */
export function LuxuryClientDashboardShell({ logoUrl, brandName, sidebarFooter, contentPadding = "default", children }: LuxuryClientDashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-luxury-background">
      <LuxuryClientSidebar logoUrl={logoUrl} brandName={brandName} footer={sidebarFooter} />
      <LuxuryClientMobileNavigation open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} logoUrl={logoUrl} brandName={brandName} footer={sidebarFooter} />
      <div className="min-w-0 flex-1">
        <button type="button" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation menu" className="mx-4 mt-4 flex h-10 w-10 items-center justify-center rounded-full bg-luxury-surface text-luxury-text shadow-luxury-sm md:hidden">
          <MenuIcon className="h-5 w-5" />
        </button>
        <main className={MAIN_PADDING_CLASS[contentPadding]}>{children}</main>
      </div>
    </div>
  );
}
