"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { groupVisibleNavigationModules } from "@/config/navigation";
import { NavigationTree } from "@/components/layout/NavigationTree";
import { WorkspaceAvatar } from "@/components/layout/WorkspaceAvatar";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

interface SidebarProps {
  workspaceDisplayName: string;
}

/**
 * GLOBAL-VISUAL-01 Round 4.5 — founder "sidebar must remain compact on
 * every page" correction. Was `getVisibleNavigationModules` (flat, ~45
 * destinations always visible) rendered through the old flat
 * `NavigationTree`; now the same grouped data (`groupVisibleNavigationModules`
 * — already computed elsewhere for the Luxury Dashboard sidebar, not
 * duplicated) through the grouped/collapsible `NavigationTree`. Borders
 * softened (`border-border/50`) to match the approved Dashboard's lighter
 * dividers. No route, permission, or destination changed.
 *
 * GLOBAL-VISUAL-03B — branding header rebuilt to the exact composition
 * `LuxurySidebar` already uses (monogram badge beside a small wordmark/logo,
 * a restrained tagline underneath), translated to the Classical `--color-*`
 * tokens rather than duplicating a new component: `--color-accent` and
 * `--luxury-rose` are the same `#7d3242` (confirmed in globals.css), so this
 * is the same brand mark, not a new one. Previously a bare `w-24` logo image
 * with no monogram — the single biggest visual gap the founder's AF Digital
 * Studio OS comparison flagged between this shell and Dashboard's. Same
 * logo asset, same brand copy, same nav data/grouping/permissions.
 *
 * GLOBAL-VISUAL-03B.2 — width ported to AF Digital Studio OS's own real
 * sidebar width (`w-64`/256px, app/(app)/_shell/sidebar.tsx, HEAD 1587d1f)
 * instead of BloomOS's prior 224px — also brings it in line with this app's
 * own mobile drawer (`MobileNav.tsx`), which was already 256px. Dashboard/
 * Team render their own separate `LuxurySidebar`, unaffected.
 *
 * GLOBAL-VISUAL-03B.3 — remaining geometry ported to AF's real sidebar:
 * brand row is now a fixed `h-16` (64px, matching AF's own brand row and
 * this app's own TopBar height) instead of content-sized; the outer
 * `py-6` wrapper padding is removed in favor of AF's own per-region
 * padding (nav's own `py-4`, footer's own `p-3`) so the brand row can sit
 * flush at the very top like AF's does.
 *
 * GLOBAL-VISUAL-04 addendum — `font-crm-sans` (AF's real Manrope interface
 * sans) applied at the shell level: a shared-primitive geometry/typography
 * change explicitly authorized to ripple beyond the CRM (Sidebar serves
 * every Classical route), verified against a non-CRM route (Events) for
 * regression before deploy. No route, permission, or destination changed.
 *
 * GLOBAL-VISUAL-04R — founder correction: the "AB" circle beside the real
 * logo was redundant/wrong, not a second brand mark. Removed; the logo
 * (already the app's own square crest, `/brand/amore-bloom-app-logo.png`)
 * is now the single mark and sized up (24px -> 40px) to fill the space the
 * badge freed, matching AF's own brand-row proportion (a compact mark sized
 * to the h-16 row, not a tiny icon lost beside a big empty badge). Same
 * logo asset, not redrawn.
 */
export function Sidebar({ workspaceDisplayName }: SidebarProps) {
  const pathname = usePathname();
  const { can } = useMemberSession();
  const groups = groupVisibleNavigationModules(can);

  return (
    <aside className="font-crm-sans hidden md:flex md:w-64 md:flex-col md:overflow-hidden md:bg-sidebar md:border-r md:border-border/50">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-border/50 px-5">
        <Image
          src="/brand/amore-bloom-app-logo.png"
          alt="Amoré Bloom"
          width={670}
          height={670}
          priority
          className="h-10 w-10 shrink-0"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text">Amoré Bloom</p>
          <p className="truncate text-[10px] tracking-[0.06em] text-text/55 uppercase">
            Luxury Proposal &amp; Event Studio
          </p>
        </div>
      </div>

      <NavigationTree groups={groups} pathname={pathname} />

      <Link
        href="/account"
        className="flex shrink-0 items-center gap-2.5 border-t border-border/50 p-3 transition-colors duration-150 hover:bg-accent/7"
      >
        <WorkspaceAvatar />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[13px] text-text">{workspaceDisplayName}</div>
          <div className="truncate text-[11.5px] text-text/55">Amoré Bloom</div>
        </div>
      </Link>
    </aside>
  );
}
