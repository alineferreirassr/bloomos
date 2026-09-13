import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function IdeasLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/ideas">{children}</RouteGuard>;
}
