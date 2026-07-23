import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function PurchasesLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/purchases">{children}</RouteGuard>;
}
