import { listSettingsSections } from "@/core/settings/sectionRegistry";
import { listSettings } from "@/core/settings/registry";
import { evaluateFeatureFlag } from "@/core/featureFlags";
import { getLogger } from "@/core/observability/logger";
import { WORKSPACE_MEMBER_ROLES, type WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { Permission } from "@/core/enums/permission";
import type { SettingDefinition, SettingsSectionDefinition } from "@/types/settings";

function roleMeetsMinimum(role: WorkspaceMemberRole, minimum: WorkspaceMemberRole): boolean {
  return WORKSPACE_MEMBER_ROLES.indexOf(role) <= WORKSPACE_MEMBER_ROLES.indexOf(minimum);
}

export interface SettingsVisibilityContext {
  workspaceId: string;
  permissions: Permission[];
  role: WorkspaceMemberRole | null;
}

function meetsGate(gate: { requiredPermissions: Permission[]; minimumRole: WorkspaceMemberRole | null }, context: SettingsVisibilityContext): boolean {
  if (gate.requiredPermissions.some((permission) => !context.permissions.includes(permission))) return false;
  if (gate.minimumRole && (!context.role || !roleMeetsMinimum(context.role, gate.minimumRole))) return false;
  return true;
}

/** Step 19's own "Track... feature flag usage" — logs the flag key and its resolved boolean, never any Setting/Section value. */
async function evaluateFlagAndLog(id: string, flag: string, workspaceId: string): Promise<boolean> {
  const enabled = await evaluateFeatureFlag(workspaceId, flag);
  getLogger().info("Settings feature flag evaluated", { id, flag, enabled });
  return enabled;
}

/**
 * Every Section this member may even see — filtered by permission/role
 * synchronously, Feature Flags checked async via `evaluateFeatureFlag`,
 * ordered by the Section's own `order`. Mirrors `listAutomationsForWorkspace`/
 * `listWorkflowNodesForWorkspace` almost exactly — Step 18's own "Role
 * aware. Section aware. Feature Flag aware," applied at the Section level.
 */
export async function listSettingsSectionsForWorkspace(context: SettingsVisibilityContext): Promise<SettingsSectionDefinition[]> {
  const candidates = listSettingsSections().filter((section) => meetsGate(section, context));
  const flagChecks = await Promise.all(
    candidates.map((section) => (section.featureFlag ? evaluateFlagAndLog(section.id, section.featureFlag, context.workspaceId) : Promise.resolve(true))),
  );
  return candidates.filter((_, index) => flagChecks[index]);
}

/**
 * Every Setting this member may even see, across every visible Section —
 * `visibility: "hidden"` is excluded unconditionally (Step 1's own
 * "Visibility" concept, distinct from permission/role/flag gating).
 * `readonly` settings are still included — they render, they just can't be
 * edited (see `SettingVisibility`'s own doc comment).
 */
export async function listSettingsForWorkspace(context: SettingsVisibilityContext): Promise<SettingDefinition[]> {
  const candidates = listSettings().filter((setting) => setting.visibility !== "hidden" && meetsGate(setting, context));
  const flagChecks = await Promise.all(
    candidates.map((setting) => (setting.featureFlag ? evaluateFlagAndLog(setting.id, setting.featureFlag, context.workspaceId) : Promise.resolve(true))),
  );
  return candidates.filter((_, index) => flagChecks[index]);
}
