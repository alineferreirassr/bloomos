import { beforeEach, describe, expect, it } from "vitest";
import { resetSettingsRegistry, listSettings } from "@/core/settings/registry";
import { resetSettingsSectionRegistry, listSettingsSections } from "@/core/settings/sectionRegistry";
import { registerSettingsSections, resetSettingsSectionsRegistration } from "@/modules/settings/registerSettingsSections";

describe("registerSettingsSections", () => {
  beforeEach(() => {
    resetSettingsRegistry();
    resetSettingsSectionRegistry();
    resetSettingsSectionsRegistration();
  });

  it("registers all 14 sections named in Steps 3-12", () => {
    registerSettingsSections();
    const ids = listSettingsSections().map((section) => section.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "general",
        "workspace",
        "branding",
        "ai",
        "skills",
        "memory",
        "automation",
        "workflow",
        "crm",
        "finance",
        "notifications",
        "security",
        "developer",
        "about",
      ]),
    );
    expect(ids).toHaveLength(14);
  });

  it("is idempotent — calling twice does not duplicate registrations", () => {
    registerSettingsSections();
    registerSettingsSections();
    expect(listSettingsSections()).toHaveLength(14);
    const settingIds = listSettings().map((setting) => setting.id);
    expect(new Set(settingIds).size).toBe(settingIds.length);
  });

  it("every registered setting points at a real, registered section", () => {
    registerSettingsSections();
    const sectionIds = new Set(listSettingsSections().map((section) => section.id));
    for (const setting of listSettings()) {
      expect(sectionIds.has(setting.sectionId)).toBe(true);
    }
  });

  it("every setting id is unique across all sections", () => {
    registerSettingsSections();
    const settingIds = listSettings().map((setting) => setting.id);
    expect(new Set(settingIds).size).toBe(settingIds.length);
  });

  it("every select-type setting declares its options", () => {
    registerSettingsSections();
    for (const setting of listSettings()) {
      if (setting.type === "select") {
        expect(setting.options && setting.options.length).toBeTruthy();
      }
    }
  });
});
