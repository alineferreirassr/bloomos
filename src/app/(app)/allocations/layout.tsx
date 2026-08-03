import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function AllocationsLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/allocations">{children}</RouteGuard>;
}
