import type { SettingChangeRecord, SettingValue } from "@/types/settings";
import type { DataResult } from "@/lib/data/result";

/**
 * The Step 1 "Workspace Storage" — persists actual setting **values**,
 * keyed by `workspaceId`/`settingId`. Definitions (type, default,
 * validation, gates) live entirely in the Settings Registry
 * (`core/settings/registry.ts`); this store never duplicates them, only
 * the per-Workspace override a member has actually saved. `getSettingValue`
 * returns `undefined` — never a fabricated default — for a setting that's
 * never been explicitly set; resolving that to the registry's own
 * `defaultValue` is `SettingsManager.getResolvedSettingValue`'s own job,
 * one layer up.
 */
export interface SettingsRepository {
  getSettingValue(workspaceId: string, settingId: string): Promise<SettingValue | undefined>;
  getAllSettingValues(workspaceId: string): Promise<Record<string, SettingValue>>;
  setSettingValue(workspaceId: string, settingId: string, value: SettingValue, changedBy: string): Promise<DataResult<SettingChangeRecord>>;
  getRecentChanges(workspaceId: string, limit: number): Promise<SettingChangeRecord[]>;
}
