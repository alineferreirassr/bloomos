import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function CalendarLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/calendar">{children}</RouteGuard>;
}
