import type { SettingDefinition, SettingsSectionDefinition } from "@/types/settings";

export const workflowSection: SettingsSectionDefinition = {
  id: "workflow",
  label: "Workflow",
  description: "How the Workflow Builder's own Editor autosaves, retains versions, and enforces validation before publish.",
  icon: "Workflow",
  order: 70,
  requiredPermissions: ["workspace.manage"],
  featureFlag: null,
  minimumRole: null,
};

function makeWorkflowSetting(
  overrides: Pick<SettingDefinition, "id" | "label" | "description" | "keywords" | "type" | "defaultValue" | "required"> & Partial<Pick<SettingDefinition, "options" | "validate">>,
): SettingDefinition {
  return {
    sectionId: "workflow",
    category: null,
    visibility: "visible",
    requiredPermissions: ["workspace.manage"],
    featureFlag: null,
    minimumRole: null,
    version: "v1",
    ...overrides,
  };
}

export const autoSaveEnabledSetting = makeWorkflowSetting({
  id: "workflow.auto-save",
  label: "Auto Save",
  description: "Save an open Workflow Editor's own draft automatically as changes are made, without waiting for an explicit save.",
  keywords: ["auto save", "autosave", "draft"],
  type: "boolean",
  defaultValue: true,
  required: false,
});

export const versionRetentionCountSetting = makeWorkflowSetting({
  id: "workflow.version-retention-count",
  label: "Version Retention",
  description: "How many past published versions the Editor's own Version History keeps per Workflow before the oldest is dropped.",
  keywords: ["version", "retention", "history"],
  type: "number",
  defaultValue: 20,
  required: true,
  validate: ({ value }) => (typeof value === "number" && value <= 0 ? "Version retention must be a positive number." : null),
});

export const validationStrictnessSetting = makeWorkflowSetting({
  id: "workflow.validation-strictness",
  label: "Validation Strictness",
  description: "Whether the Validation Engine's own warnings block publishing, or only its errors do.",
  keywords: ["validation", "strictness"],
  type: "select",
  options: [
    { label: "Errors Only", value: "errors_only" },
    { label: "Errors And Warnings", value: "errors_and_warnings" },
  ],
  defaultValue: "errors_only",
  required: true,
});

export const publishingRuleSetting = makeWorkflowSetting({
  id: "workflow.publishing-rule",
  label: "Publishing Rule",
  description: "Who may publish a Workflow so its compiled Automations go live.",
  keywords: ["publish", "publishing", "rule"],
  type: "select",
  options: [
    { label: "Any Editor", value: "any_editor" },
    { label: "Manager Or Above", value: "manager_or_above" },
    { label: "Owner Only", value: "owner_only" },
  ],
  defaultValue: "manager_or_above",
  required: true,
});

export const workflowSettings: SettingDefinition[] = [autoSaveEnabledSetting, versionRetentionCountSetting, validationStrictnessSetting, publishingRuleSetting];
