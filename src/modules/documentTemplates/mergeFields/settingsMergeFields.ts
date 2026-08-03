import { registerMergeField } from "@/core/documents/mergeFieldRegistry";
import { registerMergeResolver } from "@/core/documents/mergeEngine";
import { getSettingsManager } from "@/core/settings/manager";
import { registerSettingsSections } from "@/modules/settings/registerSettingsSections";
import type { MergeFieldDefinition } from "@/types/documentPlatform";

/**
 * The `"settings"` Merge Field domain (Step 4) — every value here is a
 * real, registered Checkpoint 11 Setting, resolved through the same
 * `SettingsManager.getResolvedSettingValue()` the Settings Platform's own UI uses (stored
 * override if one exists, else the Setting's own registered default).
 * `registerSettingsSections()` is called eagerly at module load — the same
 * idempotent, call-on-load precedent every cross-module registry
 * dependency in this codebase already follows — so a Document compiled
 * before anyone has ever opened `/settings` in this process still resolves
 * real defaults, never `null` from an empty registry.
 */
registerSettingsSections();

export const settingsMergeFieldDefinitions: MergeFieldDefinition[] = [
  { key: "workspace_timezone", label: "Workspace Timezone", description: "The Workspace's own configured Timezone Setting.", domain: "settings", valueType: "string", required: false },
  { key: "workspace_currency", label: "Workspace Currency", description: "The Workspace's own configured Currency Setting.", domain: "settings", valueType: "string", required: false },
  { key: "workspace_date_format", label: "Workspace Date Format", description: "The Workspace's own configured Date Format Setting.", domain: "settings", valueType: "string", required: false },
  { key: "brand_color", label: "Brand Color", description: "The Workspace's own configured Brand Color Setting.", domain: "settings", valueType: "string", required: false },
];

export function registerSettingsMergeFields(): void {
  for (const definition of settingsMergeFieldDefinitions) registerMergeField(definition);

  registerMergeResolver("workspace_timezone", async (context) => {
    const value = await getSettingsManager().getResolvedSettingValue(context.workspaceId, "workspace.timezone");
    return typeof value === "string" ? value : null;
  });

  registerMergeResolver("workspace_currency", async (context) => {
    const value = await getSettingsManager().getResolvedSettingValue(context.workspaceId, "workspace.currency");
    return typeof value === "string" ? value : null;
  });

  registerMergeResolver("workspace_date_format", async (context) => {
    const value = await getSettingsManager().getResolvedSettingValue(context.workspaceId, "workspace.date-format");
    return typeof value === "string" ? value : null;
  });

  registerMergeResolver("brand_color", async (context) => {
    const value = await getSettingsManager().getResolvedSettingValue(context.workspaceId, "branding.brand-color");
    return typeof value === "string" ? value : null;
  });
}
