import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function ProposalsLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/proposals">{children}</RouteGuard>;
}
