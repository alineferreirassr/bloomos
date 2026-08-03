import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetSettingsRegistry, registerSetting } from "@/core/settings/registry";
import { resetSettingsSectionRegistry, registerSettingsSection } from "@/core/settings/sectionRegistry";
import { listSettingsForWorkspace, listSettingsSectionsForWorkspace } from "@/core/settings/discovery";
import type { SettingDefinition, SettingsSectionDefinition } from "@/types/settings";

vi.mock("@/core/featureFlags", () => ({ evaluateFeatureFlag: vi.fn().mockResolvedValue(false) }));

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

function makeSetting(overrides: Partial<SettingDefinition> = {}): SettingDefinition {
  return {
    id: "test-section.setting",
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

describe("listSettingsSectionsForWorkspace", () => {
  beforeEach(() => {
    resetSettingsRegistry();
    resetSettingsSectionRegistry();
    vi.clearAllMocks();
  });

  it("returns a section with no gates for any member", async () => {
    registerSettingsSection(makeSection());
    const sections = await listSettingsSectionsForWorkspace({ workspaceId: "w1", permissions: [], role: null });
    expect(sections.map((s) => s.id)).toEqual(["test-section"]);
  });

  it("excludes a section requiring a permission the member lacks", async () => {
    registerSettingsSection(makeSection({ requiredPermissions: ["workspace.manage"] }));
    const sections = await listSettingsSectionsForWorkspace({ workspaceId: "w1", permissions: [], role: null });
    expect(sections).toEqual([]);
  });

  it("includes a section once the member has the required permission", async () => {
    registerSettingsSection(makeSection({ requiredPermissions: ["workspace.manage"] }));
    const sections = await listSettingsSectionsForWorkspace({ workspaceId: "w1", permissions: ["workspace.manage"], role: null });
    expect(sections.map((s) => s.id)).toEqual(["test-section"]);
  });

  it("excludes a section requiring a minimum role the member doesn't meet", async () => {
    registerSettingsSection(makeSection({ minimumRole: "owner" }));
    const sections = await listSettingsSectionsForWorkspace({ workspaceId: "w1", permissions: [], role: "staff" });
    expect(sections).toEqual([]);
  });

  it("includes a section once the member's role meets the minimum", async () => {
    registerSettingsSection(makeSection({ minimumRole: "owner" }));
    const sections = await listSettingsSectionsForWorkspace({ workspaceId: "w1", permissions: [], role: "owner" });
    expect(sections.map((s) => s.id)).toEqual(["test-section"]);
  });

  it("excludes a section gated behind a disabled feature flag", async () => {
    registerSettingsSection(makeSection({ featureFlag: "settings.experimental" }));
    const sections = await listSettingsSectionsForWorkspace({ workspaceId: "w1", permissions: [], role: null });
    expect(sections).toEqual([]);
  });

  it("includes a section gated behind an enabled feature flag", async () => {
    const { evaluateFeatureFlag } = await import("@/core/featureFlags");
    vi.mocked(evaluateFeatureFlag).mockResolvedValueOnce(true);
    registerSettingsSection(makeSection({ featureFlag: "settings.experimental" }));
    const sections = await listSettingsSectionsForWorkspace({ workspaceId: "w1", permissions: [], role: null });
    expect(sections.map((s) => s.id)).toEqual(["test-section"]);
  });
});

describe("listSettingsForWorkspace", () => {
  beforeEach(() => {
    resetSettingsRegistry();
    resetSettingsSectionRegistry();
    vi.clearAllMocks();
  });

  it("returns a visible setting with no gates", async () => {
    registerSetting(makeSetting());
    const settings = await listSettingsForWorkspace({ workspaceId: "w1", permissions: [], role: null });
    expect(settings.map((s) => s.id)).toEqual(["test-section.setting"]);
  });

  it("excludes a setting whose visibility is hidden, unconditionally", async () => {
    registerSetting(makeSetting({ visibility: "hidden" }));
    const settings = await listSettingsForWorkspace({ workspaceId: "w1", permissions: [], role: null });
    expect(settings).toEqual([]);
  });

  it("still includes a readonly setting — readonly renders, it just can't be edited", async () => {
    registerSetting(makeSetting({ visibility: "readonly" }));
    const settings = await listSettingsForWorkspace({ workspaceId: "w1", permissions: [], role: null });
    expect(settings.map((s) => s.id)).toEqual(["test-section.setting"]);
  });

  it("excludes a setting requiring a permission the member lacks", async () => {
    registerSetting(makeSetting({ requiredPermissions: ["workspace.manage"] }));
    const settings = await listSettingsForWorkspace({ workspaceId: "w1", permissions: [], role: null });
    expect(settings).toEqual([]);
  });

  it("excludes a setting requiring a minimum role the member doesn't meet", async () => {
    registerSetting(makeSetting({ minimumRole: "owner" }));
    const settings = await listSettingsForWorkspace({ workspaceId: "w1", permissions: [], role: "staff" });
    expect(settings).toEqual([]);
  });

  it("excludes a setting gated behind a disabled feature flag", async () => {
    registerSetting(makeSetting({ featureFlag: "settings.experimental" }));
    const settings = await listSettingsForWorkspace({ workspaceId: "w1", permissions: [], role: null });
    expect(settings).toEqual([]);
  });

  it("scopes strictly to the given workspaceId when evaluating feature flags", async () => {
    const { evaluateFeatureFlag } = await import("@/core/featureFlags");
    registerSetting(makeSetting({ featureFlag: "settings.experimental" }));
    await listSettingsForWorkspace({ workspaceId: "workspace-42", permissions: [], role: null });
    expect(evaluateFeatureFlag).toHaveBeenCalledWith("workspace-42", "settings.experimental");
  });
});
