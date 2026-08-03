import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function IntegrationsLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/integrations">{children}</RouteGuard>;
}
