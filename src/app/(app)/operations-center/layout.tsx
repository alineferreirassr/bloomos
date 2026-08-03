import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function OperationsCenterLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/operations-center">{children}</RouteGuard>;
}
