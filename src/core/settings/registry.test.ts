import { beforeEach, describe, expect, it } from "vitest";
import { getSetting, listSettings, listSettingsByCategory, listSettingsForSection, registerSetting, resetSettingsRegistry, unregisterSetting } from "@/core/settings/registry";
import type { SettingDefinition } from "@/types/settings";

function makeSetting(overrides: Partial<SettingDefinition> = {}): SettingDefinition {
  return {
    id: "test.setting",
    sectionId: "test-section",
    category: null,
    label: "Test Setting",
    description: "",
    keywords: [],
    type: "string",
    defaultValue: "",
    required: false,
    visibility: "visible",
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    version: "v1",
    ...overrides,
  };
}

describe("Settings Registry", () => {
  beforeEach(() => {
    resetSettingsRegistry();
  });

  it("registers and retrieves a setting by id", () => {
    registerSetting(makeSetting());
    expect(getSetting("test.setting")?.label).toBe("Test Setting");
  });

  it("returns undefined for an id that was never registered", () => {
    expect(getSetting("nonexistent")).toBeUndefined();
  });

  it("re-registering the same id overwrites rather than duplicates", () => {
    registerSetting(makeSetting({ label: "First" }));
    registerSetting(makeSetting({ label: "Second" }));
    expect(listSettings()).toHaveLength(1);
    expect(getSetting("test.setting")?.label).toBe("Second");
  });

  it("unregisterSetting removes it from every listing", () => {
    registerSetting(makeSetting());
    unregisterSetting("test.setting");
    expect(getSetting("test.setting")).toBeUndefined();
    expect(listSettings()).toEqual([]);
  });

  it("listSettingsForSection scopes strictly to one sectionId", () => {
    registerSetting(makeSetting({ id: "a", sectionId: "section-a" }));
    registerSetting(makeSetting({ id: "b", sectionId: "section-b" }));
    expect(listSettingsForSection("section-a").map((s) => s.id)).toEqual(["a"]);
  });

  it("listSettingsByCategory scopes to both sectionId and category", () => {
    registerSetting(makeSetting({ id: "a", sectionId: "section-a", category: "cat-1" }));
    registerSetting(makeSetting({ id: "b", sectionId: "section-a", category: "cat-2" }));
    registerSetting(makeSetting({ id: "c", sectionId: "section-b", category: "cat-1" }));
    expect(listSettingsByCategory("section-a", "cat-1").map((s) => s.id)).toEqual(["a"]);
  });

  it("resetSettingsRegistry clears every registered setting", () => {
    registerSetting(makeSetting());
    resetSettingsRegistry();
    expect(listSettings()).toEqual([]);
  });
});
