import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function SearchAnalyticsLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/search/analytics">{children}</RouteGuard>;
}
