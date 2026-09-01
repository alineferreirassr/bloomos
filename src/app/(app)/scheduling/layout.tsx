import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function SchedulingLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/scheduling">{children}</RouteGuard>;
}
