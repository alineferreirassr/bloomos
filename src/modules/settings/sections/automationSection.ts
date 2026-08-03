import type { SettingDefinition, SettingsSectionDefinition } from "@/types/settings";

export const automationSection: SettingsSectionDefinition = {
  id: "automation",
  label: "Automation",
  description: "Defaults a new Automation starts from — its own approval policy, retry count, and how a failure is handled.",
  icon: "Zap",
  order: 60,
  requiredPermissions: ["workspace.manage"],
  featureFlag: null,
  minimumRole: null,
};

function makeAutomationSetting(
  overrides: Pick<SettingDefinition, "id" | "label" | "description" | "keywords" | "type" | "defaultValue" | "required"> & Partial<Pick<SettingDefinition, "options" | "validate">>,
): SettingDefinition {
  return {
    sectionId: "automation",
    category: null,
    visibility: "visible",
    requiredPermissions: ["workspace.manage"],
    featureFlag: null,
    minimumRole: null,
    version: "v1",
    ...overrides,
  };
}

export const defaultApprovalPolicySetting = makeAutomationSetting({
  id: "automation.default-approval-policy",
  label: "Default Approval Policy",
  description: "The approval policy a newly-registered Automation starts with, before an author narrows it.",
  keywords: ["approval", "approval policy"],
  type: "select",
  options: [
    { label: "Always Required", value: "always_required" },
    { label: "Never Required", value: "never_required" },
    { label: "Workspace Configurable", value: "workspace_configurable" },
    { label: "Role Restricted", value: "role_restricted" },
  ],
  defaultValue: "workspace_configurable",
  required: true,
});

export const defaultMaxRetriesSetting = makeAutomationSetting({
  id: "automation.default-max-retries",
  label: "Default Max Retries",
  description: "How many additional attempts a failing Action gets, unless its own Automation overrides it.",
  keywords: ["retry", "retries"],
  type: "number",
  defaultValue: 1,
  required: true,
  validate: ({ value }) => (typeof value === "number" && (value < 0 || value > 5) ? "Max retries must be between 0 and 5." : null),
});

export const notifyOnFailureSetting = makeAutomationSetting({
  id: "automation.notify-on-failure",
  label: "Notify On Failure",
  description: "Send an in-app Notification to the Workspace owner whenever an Automation finishes in \"failure\" or \"partial_failure.\"",
  keywords: ["notify", "failure", "alert"],
  type: "boolean",
  defaultValue: true,
  required: false,
});

export const failureHandlingStrategySetting = makeAutomationSetting({
  id: "automation.failure-handling-strategy",
  label: "Failure Handling Strategy",
  description: "What the Automation Dashboard's own Failure Summary highlights first.",
  keywords: ["failure handling", "strategy"],
  type: "select",
  options: [
    { label: "Most Frequent First", value: "most_frequent" },
    { label: "Most Recent First", value: "most_recent" },
  ],
  defaultValue: "most_frequent",
  required: true,
});

export const automationSettings: SettingDefinition[] = [defaultApprovalPolicySetting, defaultMaxRetriesSetting, notifyOnFailureSetting, failureHandlingStrategySetting];
