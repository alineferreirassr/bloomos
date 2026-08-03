"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { registerSettingsSections } from "@/modules/settings/registerSettingsSections";
import { listSettingsForWorkspace } from "@/core/settings/discovery";
import { getSettingsManager } from "@/core/settings/manager";
import { validateSettingValue } from "@/core/settings/validation";
import { getSettingRecommendations } from "@/core/settings/recommendations";
import type { SettingChangeRecord, SettingIssue, SettingRecommendation } from "@/types/settings";

const GENERIC_ACCESS_ERROR = "The Settings dashboard isn't available right now.";
const RECENT_CHANGES_LIMIT = 10;

registerSettingsSections();

export interface SettingsRecentChangeSummary {
  id: string;
  settingId: string;
  settingLabel: string;
  sectionId: string;
  previousValue: SettingChangeRecord["previousValue"];
  newValue: SettingChangeRecord["newValue"];
  changedBy: string;
  changedAt: string;
}

export interface SettingsWorkspaceHealth {
  totalSettings: number;
  settingsWithWarnings: number;
  missingRequiredCount: number;
  /** 100 when every visible Setting is currently valid, 0 when every one of them has an active warning. */
  healthPercent: number;
}

export interface SettingsDashboardData {
  recentChanges: SettingsRecentChangeSummary[];
  recommendations: SettingRecommendation[];
  warnings: SettingIssue[];
  missingConfiguration: SettingIssue[];
  health: SettingsWorkspaceHealth;
}

export type GetSettingsDashboardDataResult = { success: true; data: SettingsDashboardData } | { success: false; error: string };

/**
 * The Step 15 Settings Dashboard's own one-call aggregate — Recently
 * Changed, Recommended Configurations, Workspace Health, Warnings, and
 * Missing Configuration, mirroring `getAutomationDashboardData.ts`'s "one
 * aggregate, computed fresh" shape. Warnings/Missing Configuration both
 * come from one validation pass over every visible Setting's own current
 * resolved value — `required_missing` issues are also, by definition,
 * exactly "Missing Configuration," so that list is a simple filter over
 * `warnings` rather than a second, separate computation.
 */
export async function getSettingsDashboardData(): Promise<GetSettingsDashboardDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const context = { workspaceId: session.workspace.id, permissions: session.permissions, role: session.membership.role };
  const [settings, storedValues, changes] = await Promise.all([
    listSettingsForWorkspace(context),
    getSettingsManager().getAllSettingValues(session.workspace.id),
    getSettingsManager().getRecentChanges(session.workspace.id, RECENT_CHANGES_LIMIT),
  ]);

  const resolvedValues: Record<string, (typeof storedValues)[string]> = {};
  for (const setting of settings) {
    resolvedValues[setting.id] = storedValues[setting.id] !== undefined ? storedValues[setting.id] : setting.defaultValue;
  }

  const validationResults = await Promise.all(settings.map((setting) => validateSettingValue(setting, resolvedValues[setting.id], context)));
  const warnings: SettingIssue[] = validationResults.flatMap((result) => (result.valid ? [] : result.issues));
  const missingConfiguration = warnings.filter((issue) => issue.code === "required_missing");

  const settingsWithWarnings = new Set(warnings.map((issue) => issue.settingId)).size;
  const health: SettingsWorkspaceHealth = {
    totalSettings: settings.length,
    settingsWithWarnings,
    missingRequiredCount: missingConfiguration.length,
    healthPercent: settings.length === 0 ? 100 : Math.round(((settings.length - settingsWithWarnings) / settings.length) * 100),
  };

  const settingsById = new Map(settings.map((setting) => [setting.id, setting]));
  const recentChanges: SettingsRecentChangeSummary[] = changes.map((change) => {
    const setting = settingsById.get(change.settingId);
    return {
      id: change.id,
      settingId: change.settingId,
      settingLabel: setting?.label ?? change.settingId,
      sectionId: setting?.sectionId ?? "",
      previousValue: change.previousValue,
      newValue: change.newValue,
      changedBy: change.changedBy,
      changedAt: change.changedAt,
    };
  });

  return {
    success: true,
    data: { recentChanges, recommendations: getSettingRecommendations(resolvedValues), warnings, missingConfiguration, health },
  };
}
