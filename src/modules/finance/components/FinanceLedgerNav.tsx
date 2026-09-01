"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";
import type { Permission } from "@/core/enums/permission";

const TABS: ReadonlyArray<{ href: string; label: string; requires?: Permission }> = [
  { href: "/finance", label: "Overview" },
  { href: "/finance/accounts", label: "Chart of Accounts", requires: "finance.accounting.view" },
  { href: "/finance/journal", label: "Journal Entries", requires: "finance.accounting.view" },
  { href: "/finance/periods", label: "Accounting Periods", requires: "finance.accounting.view" },
  { href: "/finance/reports", label: "Reports", requires: "finance.reports.view" },
];

/**
 * Local sub-navigation for the Ledger surfaces only — Invoices/Payments/
 * Expenses keep their existing pattern of being reached via the Overview
 * page's own cards/links, unchanged. Active state matches by exact href for
 * "/finance" (so it doesn't also highlight on /finance/invoices) and by
 * prefix for the other three (so /finance/journal/[id] still highlights
 * "Journal Entries"). Phase 06B — a tab whose `requires` permission the
 * caller doesn't hold is omitted entirely (never rendered-then-hidden) —
 * navigation must reflect the same `finance.accounting.view`/
 * `finance.reports.view` boundary the routes themselves enforce.
 */
export function FinanceLedgerNav() {
  const pathname = usePathname();
  const { can } = useMemberSession();
  const visibleTabs = TABS.filter((tab) => !tab.requires || can(tab.requires));

  return (
    <nav aria-label="Finance Ledger" className="flex flex-wrap gap-2 border-b border-border pb-3">
      {visibleTabs.map((tab) => {
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
