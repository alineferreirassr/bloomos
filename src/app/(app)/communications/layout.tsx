import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function CommunicationsLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/communications">{children}</RouteGuard>;
}
