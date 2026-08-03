import type { SettingDefinition, SettingsSectionDefinition } from "@/types/settings";

export const aboutSection: SettingsSectionDefinition = {
  id: "about",
  label: "About",
  description: "Purely informational — the running BloomOS version, with no editable settings of its own.",
  icon: "Info",
  order: 130,
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
};

/** Informational only, hence `readonly` — About has nothing for a member to configure, only to see. */
export const appVersionSetting: SettingDefinition = {
  id: "about.version",
  sectionId: "about",
  category: null,
  label: "Version",
  description: "The BloomOS release currently running for this Workspace.",
  keywords: ["version", "about", "release", "build"],
  type: "string",
  defaultValue: "v2.0",
  required: false,
  visibility: "readonly",
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  version: "v1",
};

export const aboutSettings: SettingDefinition[] = [appVersionSetting];
