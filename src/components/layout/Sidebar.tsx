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
 */
export function Sidebar({ workspaceDisplayName }: SidebarProps) {
  const pathname = usePathname();
  const { can } = useMemberSession();
  const groups = groupVisibleNavigationModules(can);

  return (
    <aside className="hidden md:flex md:w-56 md:flex-col md:bg-sidebar md:border-r md:border-border/50 md:py-6">
      <div className="mb-3 flex items-center gap-2.5 border-b border-border/50 px-5 pb-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-white">
          AB
        </span>
        <div className="min-w-0">
          <Image
            src="/brand/amore-bloom-app-logo.png"
            alt="Amoré Bloom"
            width={670}
            height={670}
            priority
            className="h-auto max-h-6 w-auto"
          />
          <p className="mt-1 text-[10px] tracking-[0.06em] text-text/55 uppercase">
            Luxury Proposal &amp; Event Studio
          </p>
        </div>
      </div>

      <NavigationTree groups={groups} pathname={pathname} />

      <Link
        href="/account"
        className="mt-3 flex items-center gap-2.5 border-t border-border/50 px-[23px] pt-4 transition-colors duration-150 hover:bg-accent/7"
      >
        <WorkspaceAvatar />
        <div className="leading-tight">
          <div className="text-[13px] text-text">{workspaceDisplayName}</div>
          <div className="text-[11.5px] text-text/55">Amoré Bloom</div>
        </div>
      </Link>
    </aside>
  );
}
