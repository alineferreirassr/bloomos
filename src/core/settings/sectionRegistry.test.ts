import { beforeEach, describe, expect, it } from "vitest";
import { getSettingsSection, listSettingsSections, registerSettingsSection, resetSettingsSectionRegistry, unregisterSettingsSection } from "@/core/settings/sectionRegistry";
import type { SettingsSectionDefinition } from "@/types/settings";

function makeSection(overrides: Partial<SettingsSectionDefinition> = {}): SettingsSectionDefinition {
  return {
    id: "test-section",
    label: "Test Section",
    description: "",
    icon: "Info",
    order: 0,
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    ...overrides,
  };
}

describe("Settings Section Registry", () => {
  beforeEach(() => {
    resetSettingsSectionRegistry();
  });

  it("registers and retrieves a section by id", () => {
    registerSettingsSection(makeSection());
    expect(getSettingsSection("test-section")?.label).toBe("Test Section");
  });

  it("returns undefined for an id that was never registered", () => {
    expect(getSettingsSection("nonexistent")).toBeUndefined();
  });

  it("re-registering the same id overwrites rather than duplicates", () => {
    registerSettingsSection(makeSection({ label: "First" }));
    registerSettingsSection(makeSection({ label: "Second" }));
    expect(listSettingsSections()).toHaveLength(1);
    expect(getSettingsSection("test-section")?.label).toBe("Second");
  });

  it("unregisterSettingsSection removes it from every listing", () => {
    registerSettingsSection(makeSection());
    unregisterSettingsSection("test-section");
    expect(getSettingsSection("test-section")).toBeUndefined();
    expect(listSettingsSections()).toEqual([]);
  });

  it("listSettingsSections sorts by order ascending", () => {
    registerSettingsSection(makeSection({ id: "c", order: 30 }));
    registerSettingsSection(makeSection({ id: "a", order: 10 }));
    registerSettingsSection(makeSection({ id: "b", order: 20 }));
    expect(listSettingsSections().map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("breaks an order tie alphabetically by label", () => {
    registerSettingsSection(makeSection({ id: "z", order: 10, label: "Zebra" }));
    registerSettingsSection(makeSection({ id: "a", order: 10, label: "Alpha" }));
    expect(listSettingsSections().map((s) => s.id)).toEqual(["a", "z"]);
  });

  it("resetSettingsSectionRegistry clears every registered section", () => {
    registerSettingsSection(makeSection());
    resetSettingsSectionRegistry();
    expect(listSettingsSections()).toEqual([]);
  });
});
