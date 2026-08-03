import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function BloomAILayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/bloom-ai">{children}</RouteGuard>;
}
