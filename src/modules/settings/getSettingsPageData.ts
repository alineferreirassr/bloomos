"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { registerSettingsSections } from "@/modules/settings/registerSettingsSections";
import { listSettingsForWorkspace, listSettingsSectionsForWorkspace } from "@/core/settings/discovery";
import { getSettingsManager } from "@/core/settings/manager";
import type { SelectSettingOption, SettingValue, SettingValueType, SettingVisibility, SettingsCategory } from "@/types/settings";

const GENERIC_ACCESS_ERROR = "Settings aren't available right now.";

// Registered once per process — idempotent, mirrors every other module's own call-on-load (`registerAutomationDefinitions()`, `registerWorkflowNodes()`).
registerSettingsSections();

/**
 * `SettingDefinition` minus its own `validate` function — the same
 * RSC-boundary-safety reason `AutomationActionSummary`/`WorkflowNodeSummary`
 * exist. Gating fields (`requiredPermissions`/`featureFlag`/`minimumRole`)
 * are dropped too: `listSettingsForWorkspace` has already applied them by
 * the time this list is built, so nothing client-side needs to re-check
 * them — a Setting present in this summary is, by construction, one this
 * member may see.
 */
export interface SettingSummary {
  id: string;
  sectionId: string;
  category: SettingsCategory | null;
  label: string;
  description: string;
  keywords: string[];
  type: SettingValueType;
  options?: SelectSettingOption[];
  defaultValue: SettingValue;
  required: boolean;
  visibility: SettingVisibility;
  version: string;
}

export interface SettingsSectionSummary {
  id: string;
  label: string;
  description: string;
  icon: string;
  order: number;
}

export interface SettingsPageData {
  sections: SettingsSectionSummary[];
  settingsBySection: Record<string, SettingSummary[]>;
  /** The effective value for every visible Setting — a stored override if one exists, otherwise its own registered `defaultValue`. Keyed by `settingId`. */
  values: Record<string, SettingValue>;
  workspaceId: string;
}

export type GetSettingsPageDataResult = { success: true; data: SettingsPageData } | { success: false; error: string };

/**
 * The Settings Platform's own one-call aggregate — every visible Section,
 * every visible Setting grouped under it, and every Setting's own current
 * effective value, mirroring `getAutomationDashboardData.ts`'s "one
 * aggregate, computed fresh" shape. "No hardcoded module-specific logic" is
 * this checkpoint's own success criterion: nothing here branches on a
 * specific section or setting id — it only ever walks the Registry.
 */
export async function getSettingsPageData(): Promise<GetSettingsPageDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const context = { workspaceId: session.workspace.id, permissions: session.permissions, role: session.membership.role };
  const [sections, settings, storedValues] = await Promise.all([
    listSettingsSectionsForWorkspace(context),
    listSettingsForWorkspace(context),
    getSettingsManager().getAllSettingValues(session.workspace.id),
  ]);

  const settingsBySection: Record<string, SettingSummary[]> = {};
  const values: Record<string, SettingValue> = {};

  for (const setting of settings) {
    const summary: SettingSummary = {
      id: setting.id,
      sectionId: setting.sectionId,
      category: setting.category,
      label: setting.label,
      description: setting.description,
      keywords: setting.keywords,
      type: setting.type,
      options: setting.options,
      defaultValue: setting.defaultValue,
      required: setting.required,
      visibility: setting.visibility,
      version: setting.version,
    };
    (settingsBySection[setting.sectionId] ??= []).push(summary);
    values[setting.id] = storedValues[setting.id] !== undefined ? storedValues[setting.id] : setting.defaultValue;
  }

  return {
    success: true,
    data: {
      sections: sections.map(({ id, label, description, icon, order }) => ({ id, label, description, icon, order })),
      settingsBySection,
      values,
      workspaceId: session.workspace.id,
    },
  };
}
