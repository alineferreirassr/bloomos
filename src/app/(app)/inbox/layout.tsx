import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function InboxLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/inbox">{children}</RouteGuard>;
}
