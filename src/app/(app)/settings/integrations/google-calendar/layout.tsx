import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

// GC02-02 — a nested `RouteGuard`, layered under `(app)/settings/layout.tsx`'s
// own `workspace.manage` gate: this route's own entry in `routeAccess.ts`
// (`/settings/integrations/google-calendar` → `integrations.calendar`) is
// the *more specific* requirement Next's nested-layout composition adds on
// top, not a replacement for the parent's own check.
export default function GoogleCalendarSettingsLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/settings/integrations/google-calendar">{children}</RouteGuard>;
}
