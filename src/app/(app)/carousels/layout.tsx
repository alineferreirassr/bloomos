import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function CarouselsLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/carousels">{children}</RouteGuard>;
}
