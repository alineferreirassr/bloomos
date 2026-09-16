import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function SocialStrategistLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/social-strategist">{children}</RouteGuard>;
}
