import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function CommercialPipelineLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/pipeline/commercial">{children}</RouteGuard>;
}
