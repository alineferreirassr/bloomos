"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { groupVisibleNavigationModules } from "@/config/navigation";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";
import { resolveDashboardExperience } from "@/core/dashboard/resolveDashboardExperience";
import { LuxuryNavGroupList } from "@/modules/dashboard/luxury/components/LuxuryNavGroupList";

interface LuxurySidebarProps {
  logoUrl: string | null;
  brandName: string;
  tagline: string;
  inspirationalMessage: string;
  footer: ReactNode;
}

/** Checkpoint 19, Step 3/11 — the Luxury Dashboard's own desktop sidebar. App Shell redesign — same real, permission-filtered navigation data every other Sidebar variant reads, now grouped into calm collapsible domain accordions (`groupVisibleNavigationModules` + `LuxuryNavGroupList`) instead of one long flat list. */
export function LuxurySidebar({ logoUrl, brandName, tagline, inspirationalMessage, footer }: LuxurySidebarProps) {
  const pathname = usePathname();
  const { can, role } = useMemberSession();
  const groups = groupVisibleNavigationModules(can);
  const dashboardLabel = role && resolveDashboardExperience(role) === "team" ? "My Day" : undefined;

  return (
    // Founder correction (parallel to Classical Sidebar's own GLOBAL-VISUAL-04R fix) — the
    // circular "AB" monogram beside the real logo was a duplicate brand mark, not a second
    // one. Removed; the logo/wordmark is now the single mark and sized up (24px -> 40px max
    // height) to fill the space the badge freed. Width, navigation data, grouping/collapse
    // behavior, active state, and permissions are unchanged.
    <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:border-r md:border-luxury-border md:bg-luxury-sidebar md:py-5">
      <div className="mb-3 flex items-center gap-2.5 px-5 pb-4">
        <div className="min-w-0">
          {logoUrl ? (
            <Image src={logoUrl} alt={brandName} width={640} height={640} priority className="h-auto max-h-10 w-auto" />
          ) : (
            <p className="truncate font-luxury-display text-base leading-none font-semibold text-luxury-text">{brandName}</p>
          )}
          <p className="mt-1 text-[10px] tracking-[0.06em] text-luxury-text-muted uppercase">{tagline}</p>
        </div>
      </div>

      <LuxuryNavGroupList groups={groups} pathname={pathname} dashboardLabel={dashboardLabel} />

      <div className="mx-3 mt-3 rounded-luxury-md bg-luxury-surface-tint p-3 text-center">
        <p className="font-luxury-display text-luxury-status text-luxury-text italic">{inspirationalMessage}</p>
      </div>

      <div className="mt-3 px-3">{footer}</div>
    </aside>
  );
}
