import { beforeEach, describe, expect, it } from "vitest";
import { resetSettingsRegistry } from "@/core/settings/registry";
import { resetSettingsSectionRegistry } from "@/core/settings/sectionRegistry";
import { registerSettingsSections, resetSettingsSectionsRegistration } from "@/modules/settings/registerSettingsSections";
import { searchSettings, type SettingsVisibilityContext } from "@/core/settings/search";

const ownerContext: SettingsVisibilityContext = {
  workspaceId: "workspace-1",
  permissions: ["workspace.manage"],
  role: "owner",
};

const staffContext: SettingsVisibilityContext = {
  workspaceId: "workspace-1",
  permissions: [],
  role: "staff",
};

describe("searchSettings", () => {
  beforeEach(() => {
    resetSettingsRegistry();
    resetSettingsSectionRegistry();
    resetSettingsSectionsRegistration();
    registerSettingsSections();
  });

  it("returns no results for an empty or whitespace-only query", async () => {
    expect(await searchSettings("", ownerContext)).toEqual([]);
    expect(await searchSettings("   ", ownerContext)).toEqual([]);
  });

  it("routes 'timezone' to the workspace section", async () => {
    const results = await searchSettings("timezone", ownerContext);
    expect(results[0].sectionId).toBe("workspace");
  });

  it("routes 'invoice' to the finance section", async () => {
    const results = await searchSettings("invoice", ownerContext);
    expect(results[0].sectionId).toBe("finance");
  });

  it("routes 'workflow' to the workflow section itself", async () => {
    const results = await searchSettings("workflow", ownerContext);
    expect(results[0].kind).toBe("section");
    expect(results[0].sectionId).toBe("workflow");
  });

  it("routes 'approval' to the automation section", async () => {
    const results = await searchSettings("approval", ownerContext);
    expect(results[0].sectionId).toBe("automation");
  });

  it("routes 'provider' to the ai section", async () => {
    const results = await searchSettings("provider", ownerContext);
    expect(results[0].sectionId).toBe("ai");
  });

  it("routes 'memory' to the memory section", async () => {
    const results = await searchSettings("memory", ownerContext);
    expect(results[0].sectionId).toBe("memory");
  });

  it("ranks an exact label match above a mere keyword/description match", async () => {
    const results = await searchSettings("branding", ownerContext);
    expect(results[0].sectionId).toBe("branding");
  });

  it("never surfaces a setting a member lacks permission to see", async () => {
    const ownerResults = await searchSettings("timezone", ownerContext);
    const staffResults = await searchSettings("timezone", staffContext);
    expect(ownerResults.length).toBeGreaterThan(0);
    expect(staffResults).toEqual([]);
  });

  it("caps results at 20 even for a broad single-letter query", async () => {
    const results = await searchSettings("e", ownerContext);
    expect(results.length).toBeLessThanOrEqual(20);
  });
});
