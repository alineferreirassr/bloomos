import type { SettingDefinition, SettingsSectionDefinition } from "@/types/settings";

export const developerSection: SettingsSectionDefinition = {
  id: "developer",
  label: "Developer",
  description: "Experimental features, debug mode, and how much detail Observability captures. Feature Flags are shown read-only.",
  icon: "Terminal",
  order: 120,
  requiredPermissions: ["workspace.manage"],
  featureFlag: null,
  minimumRole: "owner",
};

function makeDeveloperSetting(
  overrides: Pick<SettingDefinition, "id" | "label" | "description" | "keywords" | "type" | "defaultValue" | "required"> &
    Partial<Pick<SettingDefinition, "visibility" | "options">>,
): SettingDefinition {
  return {
    sectionId: "developer",
    category: null,
    visibility: "visible",
    requiredPermissions: ["workspace.manage"],
    featureFlag: null,
    minimumRole: "owner",
    version: "v1",
    ...overrides,
  };
}

/**
 * `core/featureFlags` already manages its own open-ended, dynamic list of
 * flag keys — forcing that into one fixed `SettingDefinition` would mean
 * special-casing the save path for a single Setting. Rather than do that,
 * this entry stays `readonly` and purely exists so Search finds "feature
 * flags" and routes here; the real per-flag list renders directly from
 * `evaluateFeatureFlag`/the flags service in the Settings UI layer (Task
 * #64), not from Settings Storage.
 */
export const featureFlagsOverviewSetting = makeDeveloperSetting({
  id: "developer.feature-flags-overview",
  label: "Feature Flags",
  description: "Registered feature flags and their current evaluation are shown read-only here, sourced live from the flags service.",
  keywords: ["feature flag", "feature flags", "flags"],
  type: "string",
  defaultValue: "",
  required: false,
  visibility: "readonly",
});

export const experimentalFeaturesEnabledSetting = makeDeveloperSetting({
  id: "developer.experimental-features-enabled",
  label: "Experimental Features",
  description: "Show in-progress features that haven't graduated to a stable Feature Flag yet.",
  keywords: ["experimental", "beta", "preview"],
  type: "boolean",
  defaultValue: false,
  required: false,
});

export const debugModeEnabledSetting = makeDeveloperSetting({
  id: "developer.debug-mode-enabled",
  label: "Debug Mode",
  description: "Surface extra diagnostic detail in the UI — raw Automation/Workflow payloads, validation traces, and similar.",
  keywords: ["debug", "debug mode"],
  type: "boolean",
  defaultValue: false,
  required: false,
});

export const observabilityLevelSetting = makeDeveloperSetting({
  id: "developer.observability-level",
  label: "Observability Level",
  description: "How much detail `core/observability`'s own logger captures for this Workspace.",
  keywords: ["observability", "logging", "logs"],
  type: "select",
  options: [
    { label: "Minimal", value: "minimal" },
    { label: "Standard", value: "standard" },
    { label: "Verbose", value: "verbose" },
  ],
  defaultValue: "standard",
  required: true,
});

export const diagnosticsOverviewSetting = makeDeveloperSetting({
  id: "developer.diagnostics-overview",
  label: "Diagnostics",
  description: "A read-only snapshot of Workspace health — registry counts, recent validation failures — surfaced in the UI layer.",
  keywords: ["diagnostics", "health", "status"],
  type: "string",
  defaultValue: "",
  required: false,
  visibility: "readonly",
});

export const developerSettings: SettingDefinition[] = [
  featureFlagsOverviewSetting,
  experimentalFeaturesEnabledSetting,
  debugModeEnabledSetting,
  observabilityLevelSetting,
  diagnosticsOverviewSetting,
];
