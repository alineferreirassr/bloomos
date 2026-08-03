import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function EventsLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/events">{children}</RouteGuard>;
}
