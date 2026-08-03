import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Renders inside the normal `AppShell` (sidebar/nav intact) — unlike
 * `AccessBlockedPage`, this is for an otherwise-legitimate active member who
 * simply lacks the one permission a specific route requires, not someone
 * with no Workspace access at all. Used by page-level route guards
 * (`core/guards/memberAccess.ts`'s `"forbidden"` reason).
 */
export function ForbiddenState() {
  return (
    <EmptyState
      title="You don't have access to this page"
      description="Your role doesn't include the permission this page requires. Contact a Workspace owner or admin if you believe this is a mistake."
    />
  );
}
