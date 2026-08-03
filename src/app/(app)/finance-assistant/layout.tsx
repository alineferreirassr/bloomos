import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function FinanceAssistantLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/finance-assistant">{children}</RouteGuard>;
}
