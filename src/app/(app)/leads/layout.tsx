import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function LeadsLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/leads">{children}</RouteGuard>;
}
