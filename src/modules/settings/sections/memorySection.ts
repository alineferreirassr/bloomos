import type { SettingDefinition, SettingsSectionDefinition } from "@/types/settings";

export const memorySection: SettingsSectionDefinition = {
  id: "memory",
  label: "Memory",
  description: "How long Bloom AI's own remembered operational history sticks around.",
  icon: "BrainCircuit",
  order: 50,
  requiredPermissions: ["workspace.manage"],
  featureFlag: null,
  minimumRole: null,
};

export const memoryRetentionDaysSetting: SettingDefinition = {
  id: "memory.retention-days",
  sectionId: "memory",
  category: null,
  label: "Memory Retention (days)",
  description: "How many days an approved AI Memory entry stays visible before it's treated as expired.",
  keywords: ["memory", "retention", "expire"],
  type: "number",
  defaultValue: 180,
  required: true,
  visibility: "visible",
  requiredPermissions: ["workspace.manage"],
  featureFlag: null,
  minimumRole: null,
  version: "v1",
  validate: ({ value }) => (typeof value === "number" && value <= 0 ? "Retention must be a positive number of days." : null),
};

export const memorySettings: SettingDefinition[] = [memoryRetentionDaysSetting];
