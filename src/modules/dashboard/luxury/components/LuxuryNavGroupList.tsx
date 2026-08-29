"use client";

import Link from "next/link";
import { useState } from "react";
import type { NavGroup } from "@/config/navigation";
import { NavChevronIcon } from "@/components/ui/icons";

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function groupContainsActive(group: NavGroup, pathname: string): boolean {
  return group.modules.some((navModule) => navModule.href && isActive(pathname, navModule.href));
}

/**
 * App Shell redesign — renders `groupVisibleNavigationModules()`'s output as
 * one collapsible accordion per domain group (Relationships, Events,
 * Operations, ...), the reference product's own "SYSTEM >" pattern, instead
 * of the prior single flat list. "Workspace" always renders open and
 * un-collapsible at the top, mirroring the reference's persistent
 * home-context items above its own accordions. A group is open by default
 * only when it contains the current route; every other group starts
 * collapsed — this is local, not persisted, so it resets on navigation to a
 * page in a different group, which is the desired "only show me where I am"
 * behavior, not a bug.
 *
 * Deliberately does not reuse `LuxuryNavRows` (which wraps its rows in its
 * own `<nav>` — fine as the sole nav landmark, but stacking several inside
 * this component's own `<nav>` would nest landmarks and fight over
 * `flex-1 overflow-y-auto`). This renders the same active-pill row styling
 * inline instead, under one shared `<nav>` for the whole sidebar.
 *
 * `dashboardLabel` is the one Team-specific, non-permission copy branch the
 * redesign calls for: the "Dashboard" entry reads "My Day" for the Team
 * experience, giving Team's nav a more personal framing without adding,
 * hiding, or renaming any other real route. Omit it (Founder) to keep the
 * module's own label as-is.
 */
export function LuxuryNavGroupList({
  groups,
  pathname,
  onNavigate,
  dashboardLabel,
}: {
  groups: NavGroup[];
  pathname: string;
  onNavigate?: () => void;
  dashboardLabel?: string;
}) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const group of groups) {
      initial[group.id] = group.id === "workspace" || groupContainsActive(group, pathname);
    }
    return initial;
  });

  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-4">
      {groups.map((group) => {
        const entries = group.modules.filter((navModule) => navModule.href && !navModule.disabled);
        if (entries.length === 0) return null;

        const rows = (
          <div className="flex flex-col gap-1">
            {entries.map((navModule) => {
              const Icon = navModule.icon;
              const href = navModule.href as string;
              const active = isActive(pathname, href);
              return (
                <Link
                  key={navModule.id}
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-luxury-full px-4 py-2.5 text-luxury-body font-medium transition-colors duration-150 ${
                    active ? "bg-luxury-rose text-luxury-rose-foreground" : "text-luxury-text hover:bg-luxury-blush"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                  {navModule.id === "dashboard" && dashboardLabel ? dashboardLabel : navModule.label}
                </Link>
              );
            })}
          </div>
        );

        if (group.id === "workspace") {
          return (
            <div key={group.id} className="pb-2">
              {rows}
            </div>
          );
        }

        const open = openGroups[group.id] ?? false;
        return (
          <div key={group.id} className="py-0.5">
            <button
              type="button"
              onClick={() => setOpenGroups((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
              aria-expanded={open}
              className="flex w-full items-center justify-between rounded-luxury-md px-4 py-2 text-[11px] font-semibold tracking-[0.08em] text-luxury-text-muted uppercase transition-colors duration-150 hover:text-luxury-text"
            >
              {group.label}
              <NavChevronIcon className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${open ? "rotate-90" : ""}`} />
            </button>
            {open ? <div className="mt-0.5">{rows}</div> : null}
          </div>
        );
      })}
    </nav>
  );
}
