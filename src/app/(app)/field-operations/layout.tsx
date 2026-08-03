import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function FieldOperationsLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/field-operations">{children}</RouteGuard>;
}
