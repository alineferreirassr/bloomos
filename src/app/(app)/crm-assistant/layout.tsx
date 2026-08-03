import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function CRMAssistantLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/crm-assistant">{children}</RouteGuard>;
}
