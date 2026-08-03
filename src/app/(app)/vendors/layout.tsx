import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function VendorsLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/vendors">{children}</RouteGuard>;
}
