import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

/** Phase 06B — Permission Hardening. Journal Entries additionally require `finance.accounting.view` — see `core/permissions/routeAccess.ts`. */
export default function FinanceJournalLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/finance/journal">{children}</RouteGuard>;
}
