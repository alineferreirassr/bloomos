"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/finance", label: "Overview" },
  { href: "/finance/accounts", label: "Chart of Accounts" },
  { href: "/finance/journal", label: "Journal Entries" },
  { href: "/finance/periods", label: "Accounting Periods" },
  { href: "/finance/reports", label: "Reports" },
] as const;

/**
 * Local sub-navigation for the Ledger surfaces only — Invoices/Payments/
 * Expenses keep their existing pattern of being reached via the Overview
 * page's own cards/links, unchanged. Active state matches by exact href for
 * "/finance" (so it doesn't also highlight on /finance/invoices) and by
 * prefix for the other three (so /finance/journal/[id] still highlights
 * "Journal Entries").
 */
export function FinanceLedgerNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Finance Ledger" className="flex flex-wrap gap-2 border-b border-border pb-3">
      {TABS.map((tab) => {
        const isActive = tab.href === "/finance" ? pathname === "/finance" : pathname.startsWith(tab.href);
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
