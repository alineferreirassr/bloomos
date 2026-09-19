"use client";

import { useState } from "react";
import Link from "next/link";
import type { NavGroup, NavLeaf, NavModule } from "@/config/navigation";
import { NavChevronIcon } from "@/components/ui/icons";

interface NavigationTreeProps {
  groups: NavGroup[];
  pathname: string;
  /** Fired on any real navigation — MobileNav uses this to close the drawer; Sidebar leaves it unset. */
  onNavigate?: () => void;
}

function isActive(pathname: string, href: string | undefined): boolean {
  if (!href) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function moduleContainsActive(navModule: NavModule, pathname: string): boolean {
  if (isActive(pathname, navModule.href)) return true;
  return navModule.children?.some((child) => isActive(pathname, child.href)) ?? false;
}

function groupContainsActive(group: NavGroup, pathname: string): boolean {
  return group.modules.some((navModule) => moduleContainsActive(navModule, pathname));
}

const SOON_BADGE = <span className="text-[10px] font-medium tracking-wide text-text/35 uppercase">Soon</span>;

/**
 * GLOBAL-VISUAL-01 Round 4.5 — founder "sidebar must remain compact on
 * every page" correction. Previously rendered all ~45 real destinations as
 * one long flat list (every module always visible at once) — the exact
 * "sidebar becomes extensive on other pages" complaint, since the approved
 * Dashboard sidebar (`LuxuryNavGroupList.tsx`) already groups the same
 * underlying destinations into collapsible accordions. This is that same
 * grouping data (`groupVisibleNavigationModules`, already computed
 * elsewhere, not duplicated) rendered with this Classical shell's own
 * tokens, so every route through `AppShell` (Calendar, Leads, Clients,
 * Events, Contracts, Finance, Team, Settings, ...) gets the same compact
 * behavior Dashboard already has — no route, permission, or destination
 * changed, purely how the same list is grouped/disclosed.
 *
 * "Workspace" renders flat/always-open (same precedent as the Luxury
 * sidebar) since it's the persistent home-context pair (Workspace,
 * Dashboard), not a real accordion group. Every other group starts
 * collapsed unless it contains the current route, and only that group
 * auto-opens — navigating to Calendar opens "Today" without expanding
 * Relationships/Events/Business/etc. This is local UI state (not
 * persisted), so it resets to "only show me where I am" on each
 * navigation to a different group, matching the Luxury sidebar's own
 * documented behavior.
 *
 * GLOBAL-VISUAL-03B.3 — item/group geometry ported to AF Digital Studio
 * OS's real sidebar (app/(app)/_shell/sidebar.tsx, HEAD 1587d1f): nav
 * padding `px-3 py-4`, `gap-1` between groups (was `gap-4`/`px-3.5`, no
 * vertical padding); group toggle row matched to AF's own AccordionGroup
 * button (`px-3 py-2 text-[0.68rem] tracking-wider`); item rows matched to
 * AF's real item geometry — `rounded-lg` (AF's own `--radius-lg`, not a
 * full pill), `px-3 py-2 text-sm`, `size-4` (16px) icons, active state
 * `bg-accent-100` + `font-medium` (AF: `bg-accent-soft` + `font-medium`,
 * BloomOS's accent-100 being the same soft-fill role). Navigation data,
 * grouping, permissions, and information architecture are unchanged —
 * visual geometry only.
 */
export function NavigationTree({ groups, pathname, onNavigate }: NavigationTreeProps) {
  const [openGroupIds, setOpenGroupIds] = useState<Set<string>>(
    () => new Set(groups.filter((group) => group.id === "workspace" || groupContainsActive(group, pathname)).map((group) => group.id)),
  );
  const [collapsedModuleIds, setCollapsedModuleIds] = useState<Set<string>>(
    () => new Set(groups.flatMap((group) => group.modules).filter((m) => m.children && !m.defaultExpanded).map((m) => m.id)),
  );

  const toggleGroup = (id: string) => {
    setOpenGroupIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleModule = (id: string) => {
    setCollapsedModuleIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderModuleRow = (navModule: NavModule) => {
    const Icon = navModule.icon;
    const hasChildren = Boolean(navModule.children?.length);
    const isExpanded = hasChildren && !collapsedModuleIds.has(navModule.id);
    const active = isActive(pathname, navModule.href) && !navModule.disabled;

    const rowClassName = `flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150 ${
      active ? "bg-accent-100 font-medium text-accent" : navModule.disabled ? "cursor-default font-normal text-text/35" : "font-normal text-text hover:bg-accent/7"
    }`;

    const rowContent = (
      <>
        <Icon className={`h-4 w-4 shrink-0 ${active ? "opacity-95" : navModule.disabled ? "opacity-40" : "opacity-60"}`} />
        <span className="flex-1">{navModule.label}</span>
        {navModule.disabled ? SOON_BADGE : null}
        {hasChildren ? <NavChevronIcon className={`h-3.5 w-3.5 shrink-0 text-text/45 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`} /> : null}
      </>
    );

    return (
      <div key={navModule.id} className="flex flex-col gap-0.5">
        {navModule.href && !navModule.disabled ? (
          <Link href={navModule.href} onClick={onNavigate} className={rowClassName}>
            {rowContent}
          </Link>
        ) : (
          <button type="button" disabled={navModule.disabled} aria-expanded={hasChildren ? isExpanded : undefined} onClick={hasChildren ? () => toggleModule(navModule.id) : undefined} className={`${rowClassName} disabled:cursor-default`}>
            {rowContent}
          </button>
        )}

        {hasChildren && isExpanded ? (
          <div className="ml-[15px] flex flex-col gap-0.5 border-l border-border/60 pl-3">
            {navModule.children!.map((child) => (
              <NavigationLeafRow key={child.id} leaf={child} pathname={pathname} onNavigate={onNavigate} />
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
      {groups.map((group) => {
        if (group.id === "workspace") {
          return (
            <div key={group.id} className="flex flex-col gap-0.5">
              {group.modules.map(renderModuleRow)}
            </div>
          );
        }

        const open = openGroupIds.has(group.id);
        return (
          <div key={group.id} className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              aria-expanded={open}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[0.68rem] font-semibold tracking-wider text-text/45 uppercase transition-colors duration-150 hover:text-text/70"
            >
              {group.label}
              <NavChevronIcon className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${open ? "rotate-90" : ""}`} />
            </button>
            {open ? <div className="flex flex-col gap-0.5">{group.modules.map(renderModuleRow)}</div> : null}
          </div>
        );
      })}
    </nav>
  );
}

function NavigationLeafRow({ leaf, pathname, onNavigate }: { leaf: NavLeaf; pathname: string; onNavigate?: () => void }) {
  const active = isActive(pathname, leaf.href) && !leaf.disabled;
  const className = `flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-[0.82rem] transition-colors duration-150 ${
    active ? "bg-accent-100 font-medium text-text" : leaf.disabled ? "cursor-default font-normal text-text/35" : "font-normal text-text hover:bg-accent/7"
  }`;

  if (leaf.href && !leaf.disabled) {
    return (
      <Link href={leaf.href} onClick={onNavigate} className={className}>
        {leaf.label}
      </Link>
    );
  }

  return (
    <div className={className}>
      <span>{leaf.label}</span>
      {leaf.disabled ? SOON_BADGE : null}
    </div>
  );
}
