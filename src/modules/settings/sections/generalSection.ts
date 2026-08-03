import type { SettingDefinition, SettingsSectionDefinition } from "@/types/settings";

export const generalSection: SettingsSectionDefinition = {
  id: "general",
  label: "General",
  description: "Where BloomOS takes you first, and how the platform greets this Workspace.",
  icon: "LayoutDashboard",
  order: 0,
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
};

export const defaultLandingPageSetting: SettingDefinition = {
  id: "general.default-landing-page",
  sectionId: "general",
  category: null,
  label: "Default Landing Page",
  description: "The page a member lands on right after signing in.",
  keywords: ["home", "start page", "landing"],
  type: "select",
  options: [
    { label: "Dashboard", value: "/dashboard" },
    { label: "Bloom AI", value: "/bloom-ai" },
    { label: "Automation Center", value: "/automation" },
    { label: "Workflows", value: "/workflows" },
  ],
  defaultValue: "/dashboard",
  required: true,
  visibility: "visible",
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  version: "v1",
};

export const generalSettings: SettingDefinition[] = [defaultLandingPageSetting];
