import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function GmailInboxLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/gmail-inbox">{children}</RouteGuard>;
}
