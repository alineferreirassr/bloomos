"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/finance/reports", label: "Overview" },
  { href: "/finance/reports/general-ledger", label: "General Ledger" },
  { href: "/finance/reports/trial-balance", label: "Trial Balance" },
  { href: "/finance/reports/profit-and-loss", label: "Profit & Loss" },
  { href: "/finance/reports/balance-sheet", label: "Balance Sheet" },
] as const;

/**
 * Local sub-navigation across the four implemented Finance Reports plus
 * their overview — mirrors FinanceLedgerNav's exact pattern (plain Links +
 * usePathname(), no new nav widget). No entry exists for Cash Flow, AR
 * Aging, or AP Aging — those remain deferred and unlinked anywhere in this
 * UI. Active state matches by exact href for "/finance/reports" (so it
 * doesn't also highlight on a specific report page) and by prefix for the
 * other four.
 */
export function FinanceReportsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Finance Reports" className="flex flex-wrap gap-2 border-b border-border pb-3">
      {TABS.map((tab) => {
        const isActive = tab.href === "/finance/reports" ? pathname === "/finance/reports" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
              isActive ? "bg-accent/12 text-accent" : "text-text-muted hover:bg-text/7 hover:text-text"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
