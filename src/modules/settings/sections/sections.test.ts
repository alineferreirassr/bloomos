import { describe, expect, it } from "vitest";
import { validateSettingValue, type SettingPermissionContext } from "@/core/settings/validation";
import { workspaceNameSetting, workspaceTimezoneSetting } from "@/modules/settings/sections/workspaceSection";
import { aiTemperatureSetting, aiTokenLimitSetting, aiConfidenceThresholdSetting, aiProviderSetting } from "@/modules/settings/sections/aiSection";
import { defaultMaxRetriesSetting } from "@/modules/settings/sections/automationSection";
import { versionRetentionCountSetting } from "@/modules/settings/sections/workflowSection";
import { riskThresholdSetting } from "@/modules/settings/sections/crmSection";
import { taxRateSetting, paymentTermsDaysSetting, lateFeePercentSetting } from "@/modules/settings/sections/financeSection";
import { memoryRetentionDaysSetting } from "@/modules/settings/sections/memorySection";
import { experimentalFeaturesEnabledSetting, observabilityLevelSetting } from "@/modules/settings/sections/developerSection";
import { sessionTimeoutMinutesSetting, mfaRequiredSetting } from "@/modules/settings/sections/securitySection";
import { defaultSkillSetting } from "@/modules/settings/sections/skillsSection";
import { brandColorSetting } from "@/modules/settings/sections/brandingSection";
import { digestFrequencySetting } from "@/modules/settings/sections/notificationsSection";
import { appVersionSetting } from "@/modules/settings/sections/aboutSection";
import { defaultLandingPageSetting } from "@/modules/settings/sections/generalSection";

const context: SettingPermissionContext = { workspaceId: "ws_1", permissions: ["workspace.manage"], role: "owner" };

describe("Workspace Settings", () => {
  it("requires a non-empty Workspace Name", async () => {
    const result = await validateSettingValue(workspaceNameSetting, "", context);
    expect(result.valid).toBe(false);
  });

  it("only accepts a Timezone value from its own listed options", async () => {
    const result = await validateSettingValue(workspaceTimezoneSetting, "Mars/Olympus_Mons", context);
    expect(result.valid).toBe(false);
  });

  it("accepts a real Timezone option", async () => {
    expect((await validateSettingValue(workspaceTimezoneSetting, "UTC", context)).valid).toBe(true);
  });
});

describe("AI Settings", () => {
  it("rejects a Temperature outside 0-1", async () => {
    expect((await validateSettingValue(aiTemperatureSetting, 1.5, context)).valid).toBe(false);
    expect((await validateSettingValue(aiTemperatureSetting, -0.1, context)).valid).toBe(false);
  });

  it("accepts a Temperature at the 0 and 1 boundaries", async () => {
    expect((await validateSettingValue(aiTemperatureSetting, 0, context)).valid).toBe(true);
    expect((await validateSettingValue(aiTemperatureSetting, 1, context)).valid).toBe(true);
  });

  it("rejects a non-positive Token Limit", async () => {
    expect((await validateSettingValue(aiTokenLimitSetting, 0, context)).valid).toBe(false);
  });

  it("rejects a Confidence Threshold outside 0-100", async () => {
    expect((await validateSettingValue(aiConfidenceThresholdSetting, 150, context)).valid).toBe(false);
  });

  it("Provider is readonly — visibility alone marks it non-editable, not a validation concern", () => {
    expect(aiProviderSetting.visibility).toBe("readonly");
  });
});

describe("Automation Settings", () => {
  it("rejects a Default Max Retries outside 0-5", async () => {
    expect((await validateSettingValue(defaultMaxRetriesSetting, 6, context)).valid).toBe(false);
    expect((await validateSettingValue(defaultMaxRetriesSetting, -1, context)).valid).toBe(false);
  });

  it("accepts a Default Max Retries within range", async () => {
    expect((await validateSettingValue(defaultMaxRetriesSetting, 3, context)).valid).toBe(true);
  });
});

describe("Workflow Settings", () => {
  it("rejects a non-positive Version Retention count", async () => {
    expect((await validateSettingValue(versionRetentionCountSetting, 0, context)).valid).toBe(false);
  });
});

describe("CRM Settings", () => {
  it("rejects a Risk Threshold outside 0-100", async () => {
    expect((await validateSettingValue(riskThresholdSetting, 101, context)).valid).toBe(false);
  });
});

describe("Finance Settings", () => {
  it("rejects a Tax Rate outside 0-100", async () => {
    expect((await validateSettingValue(taxRateSetting, -5, context)).valid).toBe(false);
  });

  it("rejects non-positive Payment Terms", async () => {
    expect((await validateSettingValue(paymentTermsDaysSetting, 0, context)).valid).toBe(false);
  });

  it("rejects a Late Fee outside 0-100", async () => {
    expect((await validateSettingValue(lateFeePercentSetting, 150, context)).valid).toBe(false);
  });
});

describe("Memory Settings", () => {
  it("rejects a non-positive retention window", async () => {
    expect((await validateSettingValue(memoryRetentionDaysSetting, -30, context)).valid).toBe(false);
  });
});

describe("Developer Settings", () => {
  it("Experimental Features is a plain boolean with no custom validation", async () => {
    expect((await validateSettingValue(experimentalFeaturesEnabledSetting, true, context)).valid).toBe(true);
  });

  it("Observability Level only accepts its own listed options", async () => {
    expect((await validateSettingValue(observabilityLevelSetting, "extreme", context)).valid).toBe(false);
    expect((await validateSettingValue(observabilityLevelSetting, "verbose", context)).valid).toBe(true);
  });
});

describe("Security Settings", () => {
  it("rejects a non-positive Session Timeout", async () => {
    const result = await validateSettingValue(sessionTimeoutMinutesSetting, -1, context);
    expect(result.valid).toBe(false);
  });

  it("MFA gate requires the owner role", () => {
    expect(mfaRequiredSetting.minimumRole).toBe("owner");
  });
});

describe("Skills / Branding / Notifications / General / About Settings", () => {
  it("Default Skill only accepts one of its own registered options", async () => {
    expect((await validateSettingValue(defaultSkillSetting, "not-a-real-skill", context)).valid).toBe(false);
  });

  it("Brand Color requires a 6-digit hex value", async () => {
    expect((await validateSettingValue(brandColorSetting, "orange", context)).valid).toBe(false);
    expect((await validateSettingValue(brandColorSetting, "#b68235", context)).valid).toBe(true);
  });

  it("Digest Frequency only accepts one of its own listed options", async () => {
    expect((await validateSettingValue(digestFrequencySetting, "hourly", context)).valid).toBe(false);
  });

  it("Default Landing Page only accepts one of its own listed options", async () => {
    expect((await validateSettingValue(defaultLandingPageSetting, "/nowhere", context)).valid).toBe(false);
  });

  it("About's Version is readonly, informational only", () => {
    expect(appVersionSetting.visibility).toBe("readonly");
  });
});
