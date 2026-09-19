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
  // GLOBAL-VISUAL-01 Round 4.4 — the approved prototype's brand mark is a small circular
  // monogram beside the wordmark, not a logo image alone; derived from the real `brandName`
  // (never hardcoded "AB") so it stays correct for any real workspace name.
  const monogram = brandName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

  return (
    // GLOBAL-VISUAL-01 Round 4.3 Revision A, then Round 4.4 — founder-flagged "substantially
    // too wide and visually heavy" / "wrong composition" correction: logo/header/decorative-
    // box/footer padding trimmed, and a circular brand monogram (the prototype's actual brand-
    // mark composition, not a logo image alone) added beside the wordmark. Width, navigation
    // data, grouping/collapse behavior, active state, and permissions are unchanged.
    <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:border-r md:border-luxury-border md:bg-luxury-sidebar md:py-5">
      <div className="mb-3 flex items-center gap-2.5 px-5 pb-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-luxury-rose text-luxury-status font-medium text-luxury-rose-foreground">{monogram}</span>
        <div className="min-w-0">
          {logoUrl ? (
            <Image src={logoUrl} alt={brandName} width={640} height={640} priority className="h-auto max-h-6 w-auto" />
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
