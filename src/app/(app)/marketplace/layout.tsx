import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function MarketplaceLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/marketplace">{children}</RouteGuard>;
}
