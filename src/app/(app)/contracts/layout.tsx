import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function ContractsLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/contracts">{children}</RouteGuard>;
}
