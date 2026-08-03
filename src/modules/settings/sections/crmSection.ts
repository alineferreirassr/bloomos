import type { SettingDefinition, SettingsSectionDefinition } from "@/types/settings";

export const crmSection: SettingsSectionDefinition = {
  id: "crm",
  label: "CRM",
  description: "Default Lead Stages, Client Statuses, Risk Thresholds, and Pipeline defaults used across the CRM module.",
  icon: "Users",
  order: 80,
  requiredPermissions: ["workspace.manage"],
  featureFlag: null,
  minimumRole: null,
};

function makeCrmSetting(
  overrides: Pick<SettingDefinition, "id" | "label" | "description" | "keywords" | "type" | "defaultValue" | "required"> & Partial<Pick<SettingDefinition, "options" | "validate">>,
): SettingDefinition {
  return {
    sectionId: "crm",
    category: null,
    visibility: "visible",
    requiredPermissions: ["workspace.manage"],
    featureFlag: null,
    minimumRole: null,
    version: "v1",
    ...overrides,
  };
}

export const defaultLeadStageSetting = makeCrmSetting({
  id: "crm.default-lead-stage",
  label: "Default Lead Stage",
  description: "The stage a newly-created Lead starts in.",
  keywords: ["lead", "lead stage", "pipeline"],
  type: "select",
  options: [
    { label: "New", value: "new" },
    { label: "Contacted", value: "contacted" },
    { label: "Qualified", value: "qualified" },
    { label: "Proposal Sent", value: "proposal_sent" },
  ],
  defaultValue: "new",
  required: true,
});

export const defaultClientStatusSetting = makeCrmSetting({
  id: "crm.default-client-status",
  label: "Default Client Status",
  description: "The status a Client record starts with once a Lead converts.",
  keywords: ["client", "client status"],
  type: "select",
  options: [
    { label: "Active", value: "active" },
    { label: "Onboarding", value: "onboarding" },
  ],
  defaultValue: "onboarding",
  required: true,
});

export const riskThresholdSetting = makeCrmSetting({
  id: "crm.risk-threshold",
  label: "Risk Threshold",
  description: "The risk score percentage at or above which a Client is flagged at-risk on the CRM Dashboard.",
  keywords: ["risk", "risk threshold", "at-risk"],
  type: "number",
  defaultValue: 70,
  required: true,
  validate: ({ value }) => (typeof value === "number" && (value < 0 || value > 100) ? "Risk threshold must be between 0 and 100." : null),
});

export const pipelineDefaultViewSetting = makeCrmSetting({
  id: "crm.pipeline-default-view",
  label: "Pipeline Default View",
  description: "How the Leads pipeline is displayed by default.",
  keywords: ["pipeline", "view", "board", "list"],
  type: "select",
  options: [
    { label: "Board", value: "board" },
    { label: "List", value: "list" },
  ],
  defaultValue: "board",
  required: true,
});

export const crmSettings: SettingDefinition[] = [defaultLeadStageSetting, defaultClientStatusSetting, riskThresholdSetting, pipelineDefaultViewSetting];
