import { afterEach, describe, expect, it } from "vitest";
import { validateSettingValue, validateSettingById } from "@/core/settings/validation";
import { registerSetting, resetSettingsRegistry } from "@/core/settings/registry";
import { getCoreFeatureFlagsService } from "@/core/featureFlags";
import { resetFeatureFlagsStore } from "@/lib/data/core/featureFlags/mockRepository";
import type { SettingDefinition } from "@/types/settings";

function stubSetting(overrides: Partial<SettingDefinition> = {}): SettingDefinition {
  return {
    id: "stub.setting",
    sectionId: "stub-section",
    category: null,
    label: "Stub Setting",
    description: "A minimal setting for validation tests.",
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

function context(overrides: Partial<{ permissions: string[]; role: string | null; workspaceId: string }> = {}) {
  return { permissions: [], role: null, workspaceId: "ws_1", ...overrides } as never;
}

afterEach(() => {
  resetSettingsRegistry();
  resetFeatureFlagsStore();
});

describe("validateSettingValue", () => {
  it("passes for a well-formed, non-required string value", async () => {
    const result = await validateSettingValue(stubSetting(), "hello", context());
    expect(result.valid).toBe(true);
  });

  it("flags required_missing when required and empty", async () => {
    const result = await validateSettingValue(stubSetting({ required: true }), "", context());
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues.map((issue) => issue.code)).toContain("required_missing");
  });

  it("a non-required setting accepts an empty value without a type error", async () => {
    const result = await validateSettingValue(stubSetting({ type: "number" }), null, context());
    expect(result.valid).toBe(true);
  });

  describe("type checking", () => {
    it("rejects a non-number value for a number setting", async () => {
      const result = await validateSettingValue(stubSetting({ type: "number" }), "not a number" as never, context());
      expect(result.valid).toBe(false);
    });

    it("accepts a real number", async () => {
      const result = await validateSettingValue(stubSetting({ type: "number" }), 42, context());
      expect(result.valid).toBe(true);
    });

    it("rejects a non-boolean value for a boolean setting", async () => {
      const result = await validateSettingValue(stubSetting({ type: "boolean" }), "true" as never, context());
      expect(result.valid).toBe(false);
    });

    it("rejects a malformed hex value for a color setting", async () => {
      const result = await validateSettingValue(stubSetting({ type: "color" }), "blue", context());
      expect(result.valid).toBe(false);
    });

    it("accepts a well-formed hex value for a color setting", async () => {
      const result = await validateSettingValue(stubSetting({ type: "color" }), "#b68235", context());
      expect(result.valid).toBe(true);
    });

    it("rejects a select value not present in its own options", async () => {
      const setting = stubSetting({ type: "select", options: [{ label: "A", value: "a" }] });
      const result = await validateSettingValue(setting, "z", context());
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.issues.map((issue) => issue.code)).toContain("invalid_option");
    });

    it("accepts a select value present in its own options", async () => {
      const setting = stubSetting({ type: "select", options: [{ label: "A", value: "a" }] });
      const result = await validateSettingValue(setting, "a", context());
      expect(result.valid).toBe(true);
    });
  });

  it("applies the setting's own custom validate function", async () => {
    const setting = stubSetting({ type: "number", validate: ({ value }) => (typeof value === "number" && value > 1 ? "Must be at most 1." : null) });
    const tooHigh = await validateSettingValue(setting, 2, context());
    const ok = await validateSettingValue(setting, 0.5, context());
    expect(tooHigh.valid).toBe(false);
    expect(ok.valid).toBe(true);
  });

  it("skips custom validate entirely for an empty, non-required value", async () => {
    const setting = stubSetting({ validate: () => "should never run" });
    const result = await validateSettingValue(setting, "", context());
    expect(result.valid).toBe(true);
  });

  describe("permission and role gating", () => {
    it("flags permission_denied when a required permission is missing", async () => {
      const setting = stubSetting({ requiredPermissions: ["workspace.manage"] });
      const result = await validateSettingValue(setting, "x", context({ permissions: [] }));
      expect(result.valid).toBe(false);
    });

    it("passes once the required permission is present", async () => {
      const setting = stubSetting({ requiredPermissions: ["workspace.manage"] });
      const result = await validateSettingValue(setting, "x", context({ permissions: ["workspace.manage"] }));
      expect(result.valid).toBe(true);
    });

    it("flags permission_denied when role is below minimumRole", async () => {
      const setting = stubSetting({ minimumRole: "manager" });
      const result = await validateSettingValue(setting, "x", context({ role: "staff" }));
      expect(result.valid).toBe(false);
    });

    it("passes once role meets minimumRole", async () => {
      const setting = stubSetting({ minimumRole: "manager" });
      const result = await validateSettingValue(setting, "x", context({ role: "owner" }));
      expect(result.valid).toBe(true);
    });
  });

  describe("feature flag gating", () => {
    it("flags feature_flag_disabled when the flag isn't enabled", async () => {
      const setting = stubSetting({ featureFlag: "new-setting" });
      const result = await validateSettingValue(setting, "x", context());
      expect(result.valid).toBe(false);
    });

    it("passes once the flag is enabled for the Workspace", async () => {
      const setting = stubSetting({ featureFlag: "new-setting" });
      await getCoreFeatureFlagsService().setFeatureFlag("ws_1", "new-setting", true);
      const result = await validateSettingValue(setting, "x", context());
      expect(result.valid).toBe(true);
    });
  });

  it("collects every applicable issue at once, not just the first", async () => {
    const setting = stubSetting({ type: "number", required: true, requiredPermissions: ["workspace.manage"] });
    const result = await validateSettingValue(setting, "not a number" as never, context({ permissions: [] }));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.map((issue) => issue.code).sort()).toEqual(["invalid_type", "permission_denied"]);
    }
  });
});

describe("validateSettingById", () => {
  it("returns unknown_setting for an id that was never registered", async () => {
    const result = await validateSettingById("ghost", "x", context());
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues[0].code).toBe("unknown_setting");
  });

  it("resolves a registered setting and validates against it", async () => {
    registerSetting(stubSetting({ id: "real.setting", required: true }));
    const result = await validateSettingById("real.setting", "", context());
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues[0].code).toBe("required_missing");
  });
});
