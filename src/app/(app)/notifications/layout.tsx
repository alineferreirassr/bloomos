import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function NotificationsLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/notifications">{children}</RouteGuard>;
}
