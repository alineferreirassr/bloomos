import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function AssetsLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/assets">{children}</RouteGuard>;
}
