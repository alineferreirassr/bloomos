import { getSetting } from "@/core/settings/registry";
import { evaluateFeatureFlag } from "@/core/featureFlags";
import { WORKSPACE_MEMBER_ROLES, type WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { Permission } from "@/core/enums/permission";
import type { SettingDefinition, SettingIssue, SettingValidationResult, SettingValue } from "@/types/settings";

function roleMeetsMinimum(role: WorkspaceMemberRole, minimum: WorkspaceMemberRole): boolean {
  return WORKSPACE_MEMBER_ROLES.indexOf(role) <= WORKSPACE_MEMBER_ROLES.indexOf(minimum);
}

function isEmpty(value: SettingValue): boolean {
  return value === null || value === undefined || value === "";
}

function checkType(setting: SettingDefinition, value: SettingValue): SettingIssue | null {
  if (isEmpty(value)) return null; // required_missing owns the empty case
  const actualType = typeof value;
  if (setting.type === "string" || setting.type === "color") {
    if (actualType !== "string") return { code: "invalid_type", settingId: setting.id, message: `"${setting.label}" must be text.` };
    if (setting.type === "color" && !/^#[0-9a-fA-F]{6}$/.test(value as string)) {
      return { code: "invalid_type", settingId: setting.id, message: `"${setting.label}" must be a 6-digit hex color (e.g. #b68235).` };
    }
    return null;
  }
  if (setting.type === "number") {
    return actualType === "number" && Number.isFinite(value) ? null : { code: "invalid_type", settingId: setting.id, message: `"${setting.label}" must be a number.` };
  }
  if (setting.type === "boolean") {
    return actualType === "boolean" ? null : { code: "invalid_type", settingId: setting.id, message: `"${setting.label}" must be true or false.` };
  }
  if (setting.type === "select") {
    if (actualType !== "string") return { code: "invalid_type", settingId: setting.id, message: `"${setting.label}" must be one of its own listed options.` };
    const validOption = (setting.options ?? []).some((option) => option.value === value);
    return validOption ? null : { code: "invalid_option", settingId: setting.id, message: `"${setting.label}" must be one of its own listed options.` };
  }
  return null;
}

export interface SettingPermissionContext {
  permissions: Permission[];
  role: WorkspaceMemberRole | null;
  workspaceId: string;
}

/**
 * The Step 13 "every setting must support" contract, run in a fixed order:
 * required → type/option → custom `validate` → permission → feature flag.
 * Collects every applicable issue rather than stopping at the first (the
 * same "surface everything at once" precedent
 * `core/workflow/graphAnalysis.ts` already established) — a caller only
 * cares whether `valid` is `true`, but a UI showing *why* a save failed
 * benefits from the full list.
 */
export async function validateSettingValue(setting: SettingDefinition, value: SettingValue, context: SettingPermissionContext): Promise<SettingValidationResult> {
  const issues: SettingIssue[] = [];

  if (setting.required && isEmpty(value)) {
    issues.push({ code: "required_missing", settingId: setting.id, message: `"${setting.label}" is required.` });
  } else {
    const typeIssue = checkType(setting, value);
    if (typeIssue) issues.push(typeIssue);
  }

  if (!isEmpty(value) && setting.validate) {
    const customMessage = setting.validate({ value, setting });
    if (customMessage) issues.push({ code: "custom_validation_failed", settingId: setting.id, message: customMessage });
  }

  if (setting.requiredPermissions.some((permission) => !context.permissions.includes(permission))) {
    issues.push({ code: "permission_denied", settingId: setting.id, message: `You don't have permission to change "${setting.label}".` });
  }
  if (setting.minimumRole && (!context.role || !roleMeetsMinimum(context.role, setting.minimumRole))) {
    issues.push({ code: "permission_denied", settingId: setting.id, message: `Your role can't change "${setting.label}".` });
  }

  if (setting.featureFlag) {
    const enabled = await evaluateFeatureFlag(context.workspaceId, setting.featureFlag);
    if (!enabled) issues.push({ code: "feature_flag_disabled", settingId: setting.id, message: `"${setting.label}" isn't enabled for this Workspace yet.` });
  }

  return issues.length === 0 ? { valid: true } : { valid: false, issues };
}

/** Looks the Setting up by id first — `unknown_setting` when it isn't registered at all, never a thrown exception for a stale/removed id. */
export async function validateSettingById(settingId: string, value: SettingValue, context: SettingPermissionContext): Promise<SettingValidationResult> {
  const setting = getSetting(settingId);
  if (!setting) return { valid: false, issues: [{ code: "unknown_setting", settingId, message: "This setting no longer exists." }] };
  return validateSettingValue(setting, value, context);
}
