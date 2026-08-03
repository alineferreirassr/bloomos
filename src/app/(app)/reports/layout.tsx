import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function ReportsLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/reports">{children}</RouteGuard>;
}
