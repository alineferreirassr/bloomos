import type { SettingDefinition, SettingsSectionDefinition } from "@/types/settings";

export const workspaceSection: SettingsSectionDefinition = {
  id: "workspace",
  label: "Workspace",
  description: "The Workspace's own identity — name, locale, and currency, shared by every module.",
  icon: "Building2",
  order: 10,
  requiredPermissions: ["workspace.manage"],
  featureFlag: null,
  minimumRole: null,
};

function makeWorkspaceSetting(overrides: Pick<SettingDefinition, "id" | "label" | "description" | "keywords" | "type" | "defaultValue" | "options" | "required">): SettingDefinition {
  return {
    sectionId: "workspace",
    category: null,
    visibility: "visible",
    requiredPermissions: ["workspace.manage"],
    featureFlag: null,
    minimumRole: null,
    version: "v1",
    ...overrides,
  };
}

export const workspaceNameSetting = makeWorkspaceSetting({
  id: "workspace.name",
  label: "Workspace Name",
  description: "The name shown throughout BloomOS and on any client-facing document.",
  keywords: ["name", "business name"],
  type: "string",
  defaultValue: "",
  required: true,
});

export const workspaceTimezoneSetting = makeWorkspaceSetting({
  id: "workspace.timezone",
  label: "Timezone",
  description: "Used for every date/time shown to a member, and for computing things like \"days overdue.\"",
  keywords: ["timezone", "time zone", "clock"],
  type: "select",
  options: [
    { label: "Pacific Time (US)", value: "America/Los_Angeles" },
    { label: "Mountain Time (US)", value: "America/Denver" },
    { label: "Central Time (US)", value: "America/Chicago" },
    { label: "Eastern Time (US)", value: "America/New_York" },
    { label: "UTC", value: "UTC" },
  ],
  defaultValue: "America/Los_Angeles",
  required: true,
});

export const workspaceLanguageSetting = makeWorkspaceSetting({
  id: "workspace.language",
  label: "Language",
  description: "The language BloomOS's own interface renders in.",
  keywords: ["language", "locale"],
  type: "select",
  options: [
    { label: "English", value: "en" },
    { label: "Spanish", value: "es" },
    { label: "Portuguese", value: "pt" },
  ],
  defaultValue: "en",
  required: true,
});

export const workspaceCurrencySetting = makeWorkspaceSetting({
  id: "workspace.currency",
  label: "Currency",
  description: "The default currency for new Invoices, Proposals, and financial reports.",
  keywords: ["currency", "money"],
  type: "select",
  options: [
    { label: "US Dollar (USD)", value: "USD" },
    { label: "Euro (EUR)", value: "EUR" },
    { label: "British Pound (GBP)", value: "GBP" },
  ],
  defaultValue: "USD",
  required: true,
});

export const workspaceDateFormatSetting = makeWorkspaceSetting({
  id: "workspace.date-format",
  label: "Date Format",
  description: "How dates render throughout the interface.",
  keywords: ["date format", "dates"],
  type: "select",
  options: [
    { label: "MM/DD/YYYY", value: "MM/DD/YYYY" },
    { label: "DD/MM/YYYY", value: "DD/MM/YYYY" },
    { label: "YYYY-MM-DD", value: "YYYY-MM-DD" },
  ],
  defaultValue: "MM/DD/YYYY",
  required: true,
});

/**
 * v2 Checkpoint 44 — the "Company Profile" fields the audit found
 * genuinely missing: a legal business name (distinct from the
 * display-facing `workspace.name`), a business address, and a tax id.
 * Read by `getWorkspaceBranding()` (`core/branding/getWorkspaceBranding.ts`)
 * for document footers/legal text — never a second, competing "company
 * profile" concept elsewhere.
 */
export const legalBusinessNameSetting = makeWorkspaceSetting({
  id: "workspace.legal-business-name",
  label: "Legal Business Name",
  description: "The Workspace's registered legal name — shown on invoices, contracts, and legal footers. Leave blank to use the Workspace Name.",
  keywords: ["legal", "business name", "company"],
  type: "string",
  defaultValue: "",
  required: false,
});

export const businessAddressSetting = makeWorkspaceSetting({
  id: "workspace.business-address",
  label: "Business Address",
  description: "Shown on invoices, contracts, and document footers.",
  keywords: ["address", "company"],
  type: "string",
  defaultValue: "",
  required: false,
});

export const taxIdSetting = makeWorkspaceSetting({
  id: "workspace.tax-id",
  label: "Tax ID",
  description: "The Workspace's own tax/business registration id — shown on invoices where required.",
  keywords: ["tax id", "ein", "vat", "company"],
  type: "string",
  defaultValue: "",
  required: false,
});

export const workspaceSettings: SettingDefinition[] = [
  workspaceNameSetting,
  workspaceTimezoneSetting,
  workspaceLanguageSetting,
  workspaceCurrencySetting,
  workspaceDateFormatSetting,
  legalBusinessNameSetting,
  businessAddressSetting,
  taxIdSetting,
];
