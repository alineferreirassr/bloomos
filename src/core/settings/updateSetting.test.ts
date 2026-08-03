import { afterEach, describe, expect, it } from "vitest";
import { updateSetting } from "@/core/settings/updateSetting";
import { getSettingsManager } from "@/core/settings/manager";
import { registerSetting, resetSettingsRegistry } from "@/core/settings/registry";
import { resetSettingsStore } from "@/lib/data/core/settings/mockRepository";
import type { SettingDefinition } from "@/types/settings";

function stubSetting(overrides: Partial<SettingDefinition> = {}): SettingDefinition {
  return {
    id: "stub.setting",
    sectionId: "stub-section",
    category: null,
    label: "Stub Setting",
    description: "A minimal setting for updateSetting tests.",
    keywords: [],
    type: "string",
    defaultValue: "default-value",
    required: false,
    visibility: "visible",
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    version: "v1",
    ...overrides,
  };
}

function context(overrides: Partial<{ permissions: string[]; role: string | null; workspaceId: string }> = {}) {
  return { permissions: [], role: null, workspaceId: "ws_1", ...overrides } as never;
}

afterEach(() => {
  resetSettingsRegistry();
  resetSettingsStore();
});

describe("updateSetting", () => {
  it("writes a valid value and returns the resulting change record", async () => {
    registerSetting(stubSetting());
    const result = await updateSetting("ws_1", "stub.setting", "new-value", "user_1", context());
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.newValue).toBe("new-value");

    expect(await getSettingsManager().getSettingValue("ws_1", "stub.setting")).toBe("new-value");
  });

  it("never writes a value that fails validation", async () => {
    registerSetting(stubSetting({ type: "number" }));
    const result = await updateSetting("ws_1", "stub.setting", "not a number", "user_1", context());
    expect(result.success).toBe(false);

    expect(await getSettingsManager().getSettingValue("ws_1", "stub.setting")).toBeUndefined();
  });

  it("fails with unknown_setting for an unregistered id, never writing anything", async () => {
    const result = await updateSetting("ws_1", "ghost", "x", "user_1", context());
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues[0].code).toBe("unknown_setting");
  });

  it("blocks a permission-gated setting for a member without the required permission", async () => {
    registerSetting(stubSetting({ requiredPermissions: ["workspace.manage"] }));
    const result = await updateSetting("ws_1", "stub.setting", "x", "user_1", context({ permissions: [] }));
    expect(result.success).toBe(false);
  });
});

describe("SettingsManager.getResolvedSettingValue", () => {
  afterEach(() => {
    resetSettingsRegistry();
    resetSettingsStore();
  });

  it("resolves to the registered defaultValue when nothing has been set", async () => {
    registerSetting(stubSetting({ defaultValue: "the-default" }));
    expect(await getSettingsManager().getResolvedSettingValue("ws_1", "stub.setting")).toBe("the-default");
  });

  it("resolves to the stored override once one exists", async () => {
    registerSetting(stubSetting({ defaultValue: "the-default" }));
    await updateSetting("ws_1", "stub.setting", "overridden", "user_1", context());
    expect(await getSettingsManager().getResolvedSettingValue("ws_1", "stub.setting")).toBe("overridden");
  });

  it("resolves to null for a settingId that was never registered", async () => {
    expect(await getSettingsManager().getResolvedSettingValue("ws_1", "ghost")).toBeNull();
  });
});
