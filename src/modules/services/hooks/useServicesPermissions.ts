"use client";

import { useMemberSession } from "@/components/providers/MemberSessionProvider";

export interface ServicesPermissions {
  canEditIdentity: boolean;
  canEditDraftVersion: boolean;
  canPublish: boolean;
  canChangeStatus: boolean;
  canArchiveRestore: boolean;
  /** Explains why every capability above is `false` when it is — the same string for all of them today, since none of this module's actions is granted independently of any other yet. `null` when every capability is granted. */
  disabledReason: string | null;
}

/**
 * The seam the Checkpoint 4 spec explicitly asked for: `core/enums/permission.ts`
 * has no `services.*` entry yet (Services was never part of the Team Portal's
 * original granular permission catalog — see docs/permissions.md), and
 * `core/permissions/routeAccess.ts` doesn't gate `/services` beyond active
 * membership either. Rather than hard-code `true` at every call site (which
 * would leave no single place to tighten later) or invent a permission
 * identifier the seeded `permissions` table doesn't recognize, every Service
 * Detail action reads its allowed-state through this one hook. Today that
 * reduces to "any active Workspace member" — matching `/services`' current
 * de facto access level — but the moment `services.manage` (or similar) is
 * added to `PERMISSIONS`, only this function's body changes; every consumer
 * (`ServiceDetailHeader`, `ServiceIdentityForm`, `DraftVersionForm`) stays
 * untouched.
 */
export function useServicesPermissions(): ServicesPermissions {
  const { status } = useMemberSession();
  const allowed = status === "active";
  const disabledReason = allowed ? null : "You don't have access to manage Services.";

  return {
    canEditIdentity: allowed,
    canEditDraftVersion: allowed,
    canPublish: allowed,
    canChangeStatus: allowed,
    canArchiveRestore: allowed,
    disabledReason,
  };
}
