import type { SettingDefinition, SettingsSectionDefinition } from "@/types/settings";

export const notificationsSection: SettingsSectionDefinition = {
  id: "notifications",
  label: "Notifications",
  description: "Which channels BloomOS uses to reach a member, and how urgent updates are bundled or escalated.",
  icon: "Bell",
  order: 100,
  requiredPermissions: ["workspace.manage"],
  featureFlag: null,
  minimumRole: null,
};

function makeNotificationsSetting(
  overrides: Pick<SettingDefinition, "id" | "label" | "description" | "keywords" | "type" | "defaultValue" | "required"> & Partial<Pick<SettingDefinition, "options" | "validate">>,
): SettingDefinition {
  return {
    sectionId: "notifications",
    category: null,
    visibility: "visible",
    requiredPermissions: ["workspace.manage"],
    featureFlag: null,
    minimumRole: null,
    version: "v1",
    ...overrides,
  };
}

export const emailNotificationsEnabledSetting = makeNotificationsSetting({
  id: "notifications.email-enabled",
  label: "Email",
  description: "Send Notification copies to a member's own email address.",
  keywords: ["email", "notify"],
  type: "boolean",
  defaultValue: true,
  required: false,
});

export const inAppNotificationsEnabledSetting = makeNotificationsSetting({
  id: "notifications.in-app-enabled",
  label: "In-App",
  description: "Show Notifications inside BloomOS itself.",
  keywords: ["in-app", "notify"],
  type: "boolean",
  defaultValue: true,
  required: false,
});

export const pushNotificationsEnabledSetting = makeNotificationsSetting({
  id: "notifications.push-enabled",
  label: "Push",
  description: "Send push Notifications to a member's own registered devices.",
  keywords: ["push", "mobile", "notify"],
  type: "boolean",
  defaultValue: false,
  required: false,
});

export const digestFrequencySetting = makeNotificationsSetting({
  id: "notifications.digest-frequency",
  label: "Digest",
  description: "How often non-urgent Notifications are bundled into a single digest instead of sent individually.",
  keywords: ["digest", "frequency", "summary"],
  type: "select",
  options: [
    { label: "Off (Immediate)", value: "off" },
    { label: "Daily", value: "daily" },
    { label: "Weekly", value: "weekly" },
  ],
  defaultValue: "daily",
  required: true,
});

export const criticalAlertsBypassDigestSetting = makeNotificationsSetting({
  id: "notifications.critical-alerts-bypass-digest",
  label: "Critical Alerts",
  description: "Send critical alerts (e.g. an Automation failure) immediately, bypassing the digest schedule above.",
  keywords: ["critical", "alert", "urgent"],
  type: "boolean",
  defaultValue: true,
  required: false,
});

export const notificationsSettings: SettingDefinition[] = [
  emailNotificationsEnabledSetting,
  inAppNotificationsEnabledSetting,
  pushNotificationsEnabledSetting,
  digestFrequencySetting,
  criticalAlertsBypassDigestSetting,
];
