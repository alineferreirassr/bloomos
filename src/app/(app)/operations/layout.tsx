import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function OperationsLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/operations">{children}</RouteGuard>;
}
