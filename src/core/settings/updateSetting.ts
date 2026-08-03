import { validateSettingById } from "@/core/settings/validation";
import { getSettingsManager } from "@/core/settings/manager";
import { getLogger } from "@/core/observability/logger";
import type { SettingPermissionContext } from "@/core/settings/validation";
import type { SettingChangeRecord, SettingIssue, SettingValue } from "@/types/settings";

export type UpdateSettingResult = { success: true; data: SettingChangeRecord } | { success: false; issues: SettingIssue[] };

/**
 * The one path a setting's own value ever changes through — validate
 * (Step 13) → write (`SettingsManager.setSettingValue`). Never writes a
 * value that failed validation; the same "validate then commit, nothing in
 * between" shape `core/workflow/publisher.ts`'s own `publishWorkflow()`
 * already established for a different domain. Logs a validation failure's
 * own `issueCount`/codes (Step 19's own "Track... validation failures") —
 * never the attempted value itself.
 */
export async function updateSetting(workspaceId: string, settingId: string, value: SettingValue, changedBy: string, context: SettingPermissionContext): Promise<UpdateSettingResult> {
  const validation = await validateSettingById(settingId, value, context);
  if (!validation.valid) {
    getLogger().warn("Setting update blocked by validation", {
      workspaceId,
      settingId,
      issueCount: validation.issues.length,
      issueCodes: validation.issues.map((issue) => issue.code),
    });
    return { success: false, issues: validation.issues };
  }

  const result = await getSettingsManager().setSettingValue(workspaceId, settingId, value, changedBy);
  if (!result.success) {
    return { success: false, issues: [{ code: "custom_validation_failed", settingId, message: result.error }] };
  }
  return { success: true, data: result.data };
}
