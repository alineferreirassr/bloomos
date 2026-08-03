"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { updateSetting } from "@/core/settings/updateSetting";
import type { SettingIssue, SettingValue } from "@/types/settings";

export type UpdateSettingActionResult = { success: true } | { success: false; issues: SettingIssue[] };

/**
 * The one Server Action a Settings UI control ever calls to persist an
 * edit — resolves the acting member's own session (never a client-supplied
 * `changedBy`/`workspaceId`, so a member can't spoof either), then defers
 * to `updateSetting()`'s own "validate then write" path. Returns only
 * `success`/`issues` — a Client Component never needs the full
 * `SettingChangeRecord` back, keeping this boundary's payload minimal.
 */
export async function updateSettingAction(settingId: string, value: SettingValue): Promise<UpdateSettingActionResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") {
    return { success: false, issues: [{ code: "permission_denied", settingId, message: "You don't have access to change this setting." }] };
  }

  const result = await updateSetting(session.workspace.id, settingId, value, session.user.id, {
    workspaceId: session.workspace.id,
    permissions: session.permissions,
    role: session.membership.role,
  });
  if (!result.success) return { success: false, issues: result.issues };
  return { success: true };
}
