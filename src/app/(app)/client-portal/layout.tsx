import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function ClientPortalAdminLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/client-portal">{children}</RouteGuard>;
}
