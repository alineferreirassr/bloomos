import type { SettingsRepository } from "@/lib/data/core/settings/repository";
import type { SettingChangeRecord, SettingValue } from "@/types/settings";
import { generateId, nowIso } from "@/lib/data/utils";
import { ok, type DataResult } from "@/lib/data/result";

/** workspaceId -> settingId -> value. */
let values = new Map<string, Map<string, SettingValue>>();
let changes: SettingChangeRecord[] = [];

/** Test-only: restore both stores to empty between test cases. */
export function resetSettingsStore(): void {
  values = new Map();
  changes = [];
}

async function getSettingValue(workspaceId: string, settingId: string): Promise<SettingValue | undefined> {
  return values.get(workspaceId)?.get(settingId);
}

async function getAllSettingValues(workspaceId: string): Promise<Record<string, SettingValue>> {
  const workspaceValues = values.get(workspaceId);
  if (!workspaceValues) return {};
  return Object.fromEntries(workspaceValues.entries());
}

async function setSettingValue(workspaceId: string, settingId: string, value: SettingValue, changedBy: string): Promise<DataResult<SettingChangeRecord>> {
  const workspaceValues = values.get(workspaceId) ?? new Map<string, SettingValue>();
  const previousValue = workspaceValues.get(settingId) ?? null;
  workspaceValues.set(settingId, value);
  values.set(workspaceId, workspaceValues);

  const record: SettingChangeRecord = {
    id: generateId("setting_change"),
    workspaceId,
    settingId,
    previousValue,
    newValue: value,
    changedBy,
    changedAt: nowIso(),
  };
  changes = [...changes, record];
  return ok(record);
}

async function getRecentChanges(workspaceId: string, limit: number): Promise<SettingChangeRecord[]> {
  // Two writes in the same test (or the same real request) can share an
  // identical millisecond `changedAt` — reversing insertion order first,
  // then sorting with a *stable* comparator, means a tie always keeps the
  // more-recently-appended record ahead, without depending on timestamp
  // resolution finer than the clock actually provides.
  return [...changes]
    .filter((change) => change.workspaceId === workspaceId)
    .reverse()
    .sort((a, b) => b.changedAt.localeCompare(a.changedAt))
    .slice(0, limit);
}

export const mockSettingsRepository: SettingsRepository = {
  getSettingValue,
  getAllSettingValues,
  setSettingValue,
  getRecentChanges,
};
