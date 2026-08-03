import type { SettingDefinition, SettingsSectionDefinition } from "@/types/settings";

export const securitySection: SettingsSectionDefinition = {
  id: "security",
  label: "Security",
  description: "Session, password, and multi-factor policy, plus read-only visibility into API Keys, the Audit Log, and Roles.",
  icon: "ShieldCheck",
  order: 110,
  requiredPermissions: ["workspace.manage"],
  featureFlag: null,
  minimumRole: "owner",
};

function makeSecuritySetting(
  overrides: Pick<SettingDefinition, "id" | "label" | "description" | "keywords" | "type" | "defaultValue" | "required"> &
    Partial<Pick<SettingDefinition, "visibility" | "options" | "validate">>,
): SettingDefinition {
  return {
    sectionId: "security",
    category: null,
    visibility: "visible",
    requiredPermissions: ["workspace.manage"],
    featureFlag: null,
    minimumRole: "owner",
    version: "v1",
    ...overrides,
  };
}

export const sessionTimeoutMinutesSetting = makeSecuritySetting({
  id: "security.session-timeout-minutes",
  label: "Session Timeout (minutes)",
  description: "How long a member can stay signed in without activity before BloomOS signs them out.",
  keywords: ["session", "timeout", "sign out"],
  type: "number",
  defaultValue: 480,
  required: true,
  validate: ({ value }) => (typeof value === "number" && value <= 0 ? "Session timeout must be a positive number of minutes." : null),
});

export const passwordPolicySetting = makeSecuritySetting({
  id: "security.password-policy",
  label: "Password Policy",
  description: "The minimum complexity required of a member's own password.",
  keywords: ["password", "policy"],
  type: "select",
  options: [
    { label: "Standard (8+ characters)", value: "standard" },
    { label: "Strong (12+, mixed case, number, symbol)", value: "strong" },
  ],
  defaultValue: "standard",
  required: true,
});

export const mfaRequiredSetting = makeSecuritySetting({
  id: "security.mfa-required",
  label: "Require MFA",
  description: "Require every member to enroll a second factor before they can sign in.",
  keywords: ["mfa", "2fa", "multi-factor", "two-factor"],
  type: "boolean",
  defaultValue: false,
  required: false,
});

/**
 * API Keys, the Audit Log, and Roles are real, already-managed concepts
 * elsewhere in BloomOS (permissions/observability, respectively) rather than
 * values this checkpoint's Settings Storage should own. They're registered
 * here as `readonly` so Global Settings Search still finds "API keys" or
 * "roles" and routes a member to this section, without this generic Setting
 * model pretending to manage a secret credential's own lifecycle.
 */
export const apiKeysOverviewSetting = makeSecuritySetting({
  id: "security.api-keys-overview",
  label: "API Keys",
  description: "API key issuance and rotation are managed outside Settings Storage. This entry exists so Search can route here.",
  keywords: ["api key", "api keys", "token"],
  type: "string",
  defaultValue: "",
  required: false,
  visibility: "readonly",
});

export const auditLogOverviewSetting = makeSecuritySetting({
  id: "security.audit-log-overview",
  label: "Audit Log",
  description: "The Workspace's Audit Log is read-only history, not a configurable value.",
  keywords: ["audit log", "audit", "history"],
  type: "string",
  defaultValue: "",
  required: false,
  visibility: "readonly",
});

export const rolesAndPermissionsOverviewSetting = makeSecuritySetting({
  id: "security.roles-and-permissions-overview",
  label: "Roles & Permissions",
  description: "Workspace roles (owner, admin, manager, staff) and their permissions are fixed by BloomOS, not editable per-workspace.",
  keywords: ["roles", "permissions", "access"],
  type: "string",
  defaultValue: "",
  required: false,
  visibility: "readonly",
});

export const securitySettings: SettingDefinition[] = [
  sessionTimeoutMinutesSetting,
  passwordPolicySetting,
  mfaRequiredSetting,
  apiKeysOverviewSetting,
  auditLogOverviewSetting,
  rolesAndPermissionsOverviewSetting,
];
