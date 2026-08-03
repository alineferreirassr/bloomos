import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function DocumentsLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/documents">{children}</RouteGuard>;
}
