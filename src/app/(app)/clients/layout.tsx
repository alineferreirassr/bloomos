import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function ClientsLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/clients">{children}</RouteGuard>;
}
