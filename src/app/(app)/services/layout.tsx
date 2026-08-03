import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function ServicesLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/services">{children}</RouteGuard>;
}
