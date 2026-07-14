"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationItems } from "@/config/navigation";
import { CURRENT_ACTOR } from "@/core/constants/actor";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-border md:bg-sidebar">
      <div className="px-7 py-8">
        <span className="font-serif text-2xl font-semibold tracking-tight text-text">
          BloomOS
        </span>
      </div>
      <nav className="flex-1 space-y-1 px-4">
        {navigationItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-3 rounded-lg py-2.5 pl-4 pr-3 text-sm font-medium tracking-tight transition-colors duration-150 ${
                isActive ? "text-text" : "text-text-muted hover:text-text"
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute top-1/2 left-0 h-4 w-[2px] -translate-y-1/2 rounded-full bg-accent transition-opacity duration-150 ${
                  isActive ? "opacity-100" : "opacity-0"
                }`}
              />
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border px-7 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
            AB
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text">{CURRENT_ACTOR}</p>
            <p className="truncate text-xs text-text-muted">Amoré Bloom</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
