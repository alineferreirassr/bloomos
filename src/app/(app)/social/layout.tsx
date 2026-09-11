import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function SocialLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/social">{children}</RouteGuard>;
}
