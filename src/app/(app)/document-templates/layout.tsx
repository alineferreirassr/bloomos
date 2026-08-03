import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

// `/document-templates` reuses the pre-existing `documents.view` permission
// (the same one `/documents`, the file-storage module, already requires) —
// no new permission was introduced, matching how `/settings` reused
// `workspace.manage` in Checkpoint 11.
export default function DocumentTemplatesLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/document-templates">{children}</RouteGuard>;
}
