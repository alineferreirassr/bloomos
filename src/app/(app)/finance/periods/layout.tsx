import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

/** Phase 06B — Permission Hardening. Accounting Periods additionally require `finance.accounting.view` — see `core/permissions/routeAccess.ts`. */
export default function FinancePeriodsLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/finance/periods">{children}</RouteGuard>;
}
