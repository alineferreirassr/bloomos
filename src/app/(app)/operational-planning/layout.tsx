import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function OperationalPlanningLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/operational-planning">{children}</RouteGuard>;
}
