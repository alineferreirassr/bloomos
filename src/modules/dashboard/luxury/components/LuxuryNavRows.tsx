import Link from "next/link";
import type { ComponentType, SVGProps } from "react";

export interface LuxuryNavEntry {
  id: string;
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The shared flat nav-row renderer behind `LuxuryNavigationList` (internal Sidebar/MobileNav) and `LuxuryClientNavigationList` (Client Portal) — one rendering implementation, two real entry sources. */
export function LuxuryNavRows({ entries, pathname, onNavigate }: { entries: LuxuryNavEntry[]; pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-4">
      {entries.map((entry) => {
        const Icon = entry.icon;
        const active = isActive(pathname, entry.href);
        return (
          <Link
            key={entry.id}
            href={entry.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-luxury-full px-4 py-2.5 text-luxury-body font-medium transition-colors duration-150 ${
              active ? "bg-luxury-blush text-luxury-rose" : "text-luxury-text hover:bg-luxury-blush"
            }`}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            {entry.label}
          </Link>
        );
      })}
    </nav>
  );
}
