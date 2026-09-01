import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

/** Phase 06B — Permission Hardening. The Chart of Accounts additionally requires `finance.accounting.view` — see `core/permissions/routeAccess.ts`. */
export default function FinanceAccountsLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/finance/accounts">{children}</RouteGuard>;
}
