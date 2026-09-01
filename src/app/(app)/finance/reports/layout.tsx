import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

/** Phase 06B — Permission Hardening. Every report page under here (General Ledger, Trial Balance, P&L, Balance Sheet) additionally requires `finance.reports.view` — see `core/permissions/routeAccess.ts`. */
export default function FinanceReportsLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/finance/reports">{children}</RouteGuard>;
}
