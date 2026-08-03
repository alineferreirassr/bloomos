import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function DeveloperLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/developer">{children}</RouteGuard>;
}
