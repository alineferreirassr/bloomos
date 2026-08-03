import { mockSettingsRepository } from "@/lib/data/core/settings/mockRepository";
import type { SettingsRepository } from "@/lib/data/core/settings/repository";
import { getSetting } from "@/core/settings/registry";
import { getLogger } from "@/core/observability/logger";
import type { SettingChangeRecord, SettingValue } from "@/types/settings";
import type { DataResult } from "@/lib/data/result";

/**
 * The one place every caller reads or writes Settings storage — sitting
 * directly on the Knowledge Store (`lib/data/core/settings/`), the same
 * "Manager sits on a Store" shape `core/automation/manager.ts`/
 * `core/workflow/manager.ts` already established. Logs safe, structural
 * fields only — `workspaceId`/`settingId`/`changedBy` — **never** the
 * actual `previousValue`/`newValue` (Step 19's own "Never log sensitive
 * values"; the persisted `SettingChangeRecord` itself is a separate,
 * legitimate audit contract — see that type's own doc comment).
 */
export function getSettingsManager(): SettingsManager {
  return settingsManager;
}

export interface SettingsManager {
  getSettingValue(workspaceId: string, settingId: string): Promise<SettingValue | undefined>;
  getAllSettingValues(workspaceId: string): Promise<Record<string, SettingValue>>;
  /** Resolves the *effective* value — the stored override if one exists, otherwise the Setting's own registered `defaultValue`. `null` for a `settingId` that isn't registered at all. The one function real runtime code should call, matching the architecture's own "Workspace Storage → Runtime" arrow. */
  getResolvedSettingValue(workspaceId: string, settingId: string): Promise<SettingValue>;
  setSettingValue(workspaceId: string, settingId: string, value: SettingValue, changedBy: string): Promise<DataResult<SettingChangeRecord>>;
  getRecentChanges(workspaceId: string, limit: number): Promise<SettingChangeRecord[]>;
}

function knowledgeStore(): SettingsRepository {
  return mockSettingsRepository;
}

async function getSettingValue(workspaceId: string, settingId: string): Promise<SettingValue | undefined> {
  return knowledgeStore().getSettingValue(workspaceId, settingId);
}

async function getAllSettingValues(workspaceId: string): Promise<Record<string, SettingValue>> {
  return knowledgeStore().getAllSettingValues(workspaceId);
}

async function getResolvedSettingValue(workspaceId: string, settingId: string): Promise<SettingValue> {
  const stored = await knowledgeStore().getSettingValue(workspaceId, settingId);
  if (stored !== undefined) return stored;
  return getSetting(settingId)?.defaultValue ?? null;
}

async function setSettingValue(workspaceId: string, settingId: string, value: SettingValue, changedBy: string): Promise<DataResult<SettingChangeRecord>> {
  const result = await knowledgeStore().setSettingValue(workspaceId, settingId, value, changedBy);
  if (result.success) getLogger().info("Setting changed", { workspaceId, settingId, changedBy });
  return result;
}

async function getRecentChanges(workspaceId: string, limit: number): Promise<SettingChangeRecord[]> {
  return knowledgeStore().getRecentChanges(workspaceId, limit);
}

const settingsManager: SettingsManager = {
  getSettingValue,
  getAllSettingValues,
  getResolvedSettingValue,
  setSettingValue,
  getRecentChanges,
};
