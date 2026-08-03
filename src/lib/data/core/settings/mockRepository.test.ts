import { afterEach, describe, expect, it } from "vitest";
import { mockSettingsRepository, resetSettingsStore } from "@/lib/data/core/settings/mockRepository";

afterEach(() => resetSettingsStore());

describe("mockSettingsRepository", () => {
  it("returns undefined for a setting that has never been set", async () => {
    expect(await mockSettingsRepository.getSettingValue("ws_1", "stub.setting")).toBeUndefined();
  });

  it("round-trips a set value", async () => {
    await mockSettingsRepository.setSettingValue("ws_1", "stub.setting", "hello", "user_1");
    expect(await mockSettingsRepository.getSettingValue("ws_1", "stub.setting")).toBe("hello");
  });

  it("scopes values independently per workspace", async () => {
    await mockSettingsRepository.setSettingValue("ws_1", "stub.setting", "a", "user_1");
    await mockSettingsRepository.setSettingValue("ws_2", "stub.setting", "b", "user_1");
    expect(await mockSettingsRepository.getSettingValue("ws_1", "stub.setting")).toBe("a");
    expect(await mockSettingsRepository.getSettingValue("ws_2", "stub.setting")).toBe("b");
  });

  it("getAllSettingValues returns every value set for a workspace", async () => {
    await mockSettingsRepository.setSettingValue("ws_1", "a", 1, "user_1");
    await mockSettingsRepository.setSettingValue("ws_1", "b", 2, "user_1");
    expect(await mockSettingsRepository.getAllSettingValues("ws_1")).toEqual({ a: 1, b: 2 });
  });

  it("getAllSettingValues returns an empty object for a workspace with nothing set", async () => {
    expect(await mockSettingsRepository.getAllSettingValues("ws_1")).toEqual({});
  });

  it("records a change with the correct previousValue/newValue on first write", async () => {
    const result = await mockSettingsRepository.setSettingValue("ws_1", "stub.setting", "first", "user_1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.previousValue).toBeNull();
      expect(result.data.newValue).toBe("first");
    }
  });

  it("records a change with the prior value as previousValue on a subsequent write", async () => {
    await mockSettingsRepository.setSettingValue("ws_1", "stub.setting", "first", "user_1");
    const result = await mockSettingsRepository.setSettingValue("ws_1", "stub.setting", "second", "user_1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.previousValue).toBe("first");
      expect(result.data.newValue).toBe("second");
    }
  });

  it("getRecentChanges orders newest first and respects the limit, scoped by workspace", async () => {
    await mockSettingsRepository.setSettingValue("ws_1", "a", 1, "user_1");
    await mockSettingsRepository.setSettingValue("ws_1", "b", 2, "user_1");
    await mockSettingsRepository.setSettingValue("ws_other", "c", 3, "user_1");

    const results = await mockSettingsRepository.getRecentChanges("ws_1", 1);
    expect(results).toHaveLength(1);
    expect(results[0].settingId).toBe("b");
  });

  it("resetSettingsStore clears both values and change history", async () => {
    await mockSettingsRepository.setSettingValue("ws_1", "stub.setting", "x", "user_1");
    resetSettingsStore();
    expect(await mockSettingsRepository.getSettingValue("ws_1", "stub.setting")).toBeUndefined();
    expect(await mockSettingsRepository.getRecentChanges("ws_1", 10)).toEqual([]);
  });
});
