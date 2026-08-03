import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/analytics">{children}</RouteGuard>;
}
