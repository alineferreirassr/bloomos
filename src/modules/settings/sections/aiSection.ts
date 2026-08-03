import type { SettingDefinition, SettingsSectionDefinition } from "@/types/settings";

export const aiSection: SettingsSectionDefinition = {
  id: "ai",
  label: "AI",
  description: "How Bloom AI's own Skills generate — provider, creativity, and the confidence bar a draft must clear.",
  icon: "Sparkles",
  order: 30,
  requiredPermissions: ["workspace.manage"],
  featureFlag: null,
  minimumRole: null,
};

function makeAiSetting(
  overrides: Pick<SettingDefinition, "id" | "label" | "description" | "keywords" | "type" | "defaultValue" | "required"> &
    Partial<Pick<SettingDefinition, "visibility" | "validate" | "options">>,
): SettingDefinition {
  return {
    sectionId: "ai",
    category: null,
    visibility: "visible",
    requiredPermissions: ["workspace.manage"],
    featureFlag: null,
    minimumRole: null,
    version: "v1",
    ...overrides,
  };
}

/** `readonly` — this reflects `isAIConfigured()`'s own real state (see `getSettingsDashboardData.ts`), not something this checkpoint's own storage layer is authoritative over. */
export const aiProviderSetting = makeAiSetting({
  id: "ai.provider",
  label: "Provider",
  description: "Which AI provider Bloom AI's Skills call. Read-only — set by registering a live provider, not from this page.",
  keywords: ["provider", "model"],
  type: "string",
  defaultValue: "mock",
  required: false,
  visibility: "readonly",
});

export const aiTemperatureSetting = makeAiSetting({
  id: "ai.temperature",
  label: "Temperature",
  description: "How much creative variance a Skill's own generation allows — 0 is fully deterministic, 1 is maximally varied.",
  keywords: ["temperature", "creativity", "randomness"],
  type: "number",
  defaultValue: 0.3,
  required: true,
  validate: ({ value }) => (typeof value === "number" && (value < 0 || value > 1) ? "Temperature must be between 0 and 1." : null),
});

export const aiTokenLimitSetting = makeAiSetting({
  id: "ai.token-limit",
  label: "Token Limit",
  description: "The maximum tokens reserved for one Skill's own generated output.",
  keywords: ["tokens", "token limit", "length"],
  type: "number",
  defaultValue: 2000,
  required: true,
  validate: ({ value }) => (typeof value === "number" && value <= 0 ? "Token limit must be a positive number." : null),
});

export const aiConfidenceThresholdSetting = makeAiSetting({
  id: "ai.confidence-threshold",
  label: "Confidence Threshold",
  description: "The minimum confidence percentage a Skill's own draft must reach before it's shown as ready for review, rather than flagged as low-confidence.",
  keywords: ["confidence", "threshold", "quality bar"],
  type: "number",
  defaultValue: 60,
  required: true,
  validate: ({ value }) => (typeof value === "number" && (value < 0 || value > 100) ? "Confidence threshold must be between 0 and 100." : null),
});

export const aiSettings: SettingDefinition[] = [aiProviderSetting, aiTemperatureSetting, aiTokenLimitSetting, aiConfidenceThresholdSetting];
