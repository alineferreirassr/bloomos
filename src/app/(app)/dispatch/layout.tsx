import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function DispatchLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/dispatch">{children}</RouteGuard>;
}
