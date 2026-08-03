import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function InventoryLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/inventory">{children}</RouteGuard>;
}
