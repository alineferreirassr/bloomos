import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

// `/settings` already carries a `workspace.manage` requirement in
// `core/permissions/routeAccess.ts`, reserved ahead of this page existing.
// This is the checkpoint that finally activates it.
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/settings">{children}</RouteGuard>;
}
