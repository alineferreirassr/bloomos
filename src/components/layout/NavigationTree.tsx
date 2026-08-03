"use client";

import { useState } from "react";
import Link from "next/link";
import type { NavLeaf, NavModule } from "@/config/navigation";
import { NavChevronIcon } from "@/components/ui/icons";

interface NavigationTreeProps {
  modules: NavModule[];
  pathname: string;
  /** Fired on any real navigation — MobileNav uses this to close the drawer; Sidebar leaves it unset. */
  onNavigate?: () => void;
}

function isActive(pathname: string, href: string | undefined): boolean {
  if (!href) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const SOON_BADGE = (
  <span className="text-[10px] font-medium tracking-wide text-text/35 uppercase">Soon</span>
);

/**
 * The one rendering implementation for the hierarchical, data-driven sidebar
 * — shared by `Sidebar` (desktop) and `MobileNav` so the expand/collapse
 * behavior, active-state styling, and disabled/"Soon" treatment only exist
 * once. A module renders as a `Link` when it has a direct `href` and isn't
 * disabled; otherwise as a toggle `button` (expanding its children, or just
 * inert if disabled with no children yet).
 */
export function NavigationTree({ modules, pathname, onNavigate }: NavigationTreeProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(
    () => new Set(modules.filter((m) => m.children && !m.defaultExpanded).map((m) => m.id)),
  );

  const toggle = (id: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3.5">
      {modules.map((navModule) => {
        const Icon = navModule.icon;
        const hasChildren = Boolean(navModule.children?.length);
        const isExpanded = hasChildren && !collapsedIds.has(navModule.id);
        const active = isActive(pathname, navModule.href) && !navModule.disabled;

        const rowClassName = `flex w-full items-center gap-2.5 rounded-full px-3.5 py-2.5 text-left text-[14.5px] transition-colors duration-150 ${
          active
            ? "bg-accent/12 font-semibold text-text"
            : navModule.disabled
              ? "cursor-default font-normal text-text/35"
              : "font-normal text-text hover:bg-accent/7"
        }`;

        const rowContent = (
          <>
            <Icon
              className={`h-[17px] w-[17px] shrink-0 ${
                active ? "opacity-95" : navModule.disabled ? "opacity-40" : "opacity-60"
              }`}
            />
            <span className="flex-1">{navModule.label}</span>
            {navModule.disabled ? SOON_BADGE : null}
            {hasChildren ? (
              <NavChevronIcon
                className={`h-3.5 w-3.5 shrink-0 text-text/45 transition-transform duration-150 ${
                  isExpanded ? "rotate-90" : ""
                }`}
              />
            ) : null}
          </>
        );

        return (
          <div key={navModule.id} className="flex flex-col gap-0.5">
            {navModule.href && !navModule.disabled ? (
              <Link href={navModule.href} onClick={onNavigate} className={rowClassName}>
                {rowContent}
              </Link>
            ) : (
              <button
                type="button"
                disabled={navModule.disabled}
                aria-expanded={hasChildren ? isExpanded : undefined}
                onClick={hasChildren ? () => toggle(navModule.id) : undefined}
                className={`${rowClassName} disabled:cursor-default`}
              >
                {rowContent}
              </button>
            )}

            {hasChildren && isExpanded ? (
              <div className="ml-[15px] flex flex-col gap-0.5 border-l border-border pl-3">
                {navModule.children!.map((child) => (
                  <NavigationLeafRow key={child.id} leaf={child} pathname={pathname} onNavigate={onNavigate} />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

function NavigationLeafRow({
  leaf,
  pathname,
  onNavigate,
}: {
  leaf: NavLeaf;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = isActive(pathname, leaf.href) && !leaf.disabled;
  const className = `flex items-center justify-between gap-2 rounded-full px-3.5 py-1.5 text-[13.5px] transition-colors duration-150 ${
    active
      ? "bg-accent/12 font-semibold text-text"
      : leaf.disabled
        ? "cursor-default font-normal text-text/35"
        : "font-normal text-text hover:bg-accent/7"
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
