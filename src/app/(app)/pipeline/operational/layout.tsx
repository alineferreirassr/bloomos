import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function OperationalPipelineLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/pipeline/operational">{children}</RouteGuard>;
}
