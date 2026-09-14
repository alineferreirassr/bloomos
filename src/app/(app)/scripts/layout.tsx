import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function ScriptsLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/scripts">{children}</RouteGuard>;
}
