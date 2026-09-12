import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function InspirationLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/inspiration">{children}</RouteGuard>;
}
