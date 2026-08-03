import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function RouteOptimizationLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/route-optimization">{children}</RouteGuard>;
}
