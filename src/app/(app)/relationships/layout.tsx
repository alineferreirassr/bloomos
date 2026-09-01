import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function RelationshipsLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/relationships">{children}</RouteGuard>;
}
