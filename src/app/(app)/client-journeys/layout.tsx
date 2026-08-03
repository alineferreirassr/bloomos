import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function ClientJourneysLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/client-journeys">{children}</RouteGuard>;
}
