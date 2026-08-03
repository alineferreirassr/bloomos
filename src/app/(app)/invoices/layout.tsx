import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function InvoicesLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/invoices">{children}</RouteGuard>;
}
