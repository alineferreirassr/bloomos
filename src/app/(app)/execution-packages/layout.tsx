import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function ExecutionPackagesLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/execution-packages">{children}</RouteGuard>;
}
