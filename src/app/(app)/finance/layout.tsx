import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function FinanceLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/finance">{children}</RouteGuard>;
}
