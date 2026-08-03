import { NOTIFICATION_CHANNELS, NOTIFICATION_KINDS, type Notification } from "@/core/notifications/types";
import { isChannelConfigured } from "@/core/notifications/registry";
import type { NotificationTemplate } from "@/types/notificationPlatform";
import type { NotificationFinding, NotificationHealthCategoryScore, NotificationHealthReport } from "@/types/notificationHealth";

/**
 * v2.0 Checkpoint 41, Step 6 — Notification Health Engine. Same
 * category-score composite pattern `core/search/searchHealthEngine.ts`
 * (Checkpoint 40) already established for its own domain — see that
 * file's own doc comment, which this one mirrors. Every score here is
 * computed from data the caller already fetched; this engine detects
 * nothing on its own and never calls a repository.
 */

const MIN_SCORE = 0;
const MAX_SCORE = 100;

function clampScore(score: number): number {
  return Math.max(MIN_SCORE, Math.min(MAX_SCORE, Math.round(score)));
}

function computeDeliveryReadinessCategory(): NotificationHealthCategoryScore {
  const configuredChannels = NOTIFICATION_CHANNELS.filter((channel) => isChannelConfigured(channel));
  const unconfigured = NOTIFICATION_CHANNELS.filter((channel) => !isChannelConfigured(channel));
  const score = clampScore((configuredChannels.length / NOTIFICATION_CHANNELS.length) * 100);
  return {
    category: "delivery_readiness",
    score,
    issues: unconfigured.length > 0 ? [`${unconfigured.length} of ${NOTIFICATION_CHANNELS.length} channels have no delivery provider registered: ${unconfigured.join(", ")}.`] : [],
    notApplicableReason: null,
  };
}

function computeTemplateCoverageCategory(templates: NotificationTemplate[]): NotificationHealthCategoryScore {
  const coveredKinds = new Set(templates.filter((t) => t.archived_at === null).map((t) => t.kind));
  const missingKinds = NOTIFICATION_KINDS.filter((kind) => !coveredKinds.has(kind));
  const score = clampScore((coveredKinds.size / NOTIFICATION_KINDS.length) * 100);
  return {
    category: "template_coverage",
    score,
    issues: missingKinds.length > 0 ? [`${missingKinds.length} notification kind(s) have no active template: ${missingKinds.join(", ")}.`] : [],
    notApplicableReason: null,
  };
}

/** Verifies the real "exactly one recipient" invariant `createInAppNotification` enforces at write time — a non-zero count here would mean a data-integrity regression, not a normal steady state, but the engine checks rather than assumes. */
function computeRoutingHealthCategory(notifications: Notification[]): NotificationHealthCategoryScore {
  if (notifications.length === 0) return { category: "routing_health", score: null, issues: [], notApplicableReason: "No notifications recorded yet." };
  const malformed = notifications.filter((n) => (n.recipient_member_id === null) === (n.recipient_client_account_id === null));
  const score = clampScore(100 - (malformed.length / notifications.length) * 100);
  return {
    category: "routing_health",
    score,
    issues: malformed.length > 0 ? [`${malformed.length} notification(s) have zero or two recipients set — a routing integrity issue.`] : [],
    notApplicableReason: null,
  };
}

function computePreferenceHealthCategory(totalMembers: number, membersWithConfiguredPreferences: number): NotificationHealthCategoryScore {
  if (totalMembers === 0) return { category: "preference_health", score: null, issues: [], notApplicableReason: "No workspace members yet." };
  const score = clampScore((membersWithConfiguredPreferences / totalMembers) * 100);
  const unconfigured = totalMembers - membersWithConfiguredPreferences;
  return {
    category: "preference_health",
    score,
    issues: unconfigured > 0 ? [`${unconfigured} of ${totalMembers} member(s) have never customized their notification preferences (still on defaults).`] : [],
    notApplicableReason: null,
  };
}

/** Reads how much of the 5-setting workspace-level notification configuration surface (`modules/settings/sections/notificationsSection.ts`) has an explicit stored value rather than sitting on its registered default — the caller resolves this via `getSettingsManager()`, this engine just scores the ratio it's handed. */
function computeConfigurationHealthCategory(configuredWorkspaceSettingsCount: number, totalWorkspaceSettings: number): NotificationHealthCategoryScore {
  const score = clampScore((configuredWorkspaceSettingsCount / totalWorkspaceSettings) * 100);
  return {
    category: "configuration_health",
    score,
    issues: configuredWorkspaceSettingsCount === 0 ? ["No workspace-level notification defaults have been explicitly configured yet — every value is still on its registered default."] : [],
    notApplicableReason: null,
  };
}

function findingsFromCategories(categories: NotificationHealthCategoryScore[]): NotificationFinding[] {
  const findings: NotificationFinding[] = [];
  for (const category of categories) {
    for (const issue of category.issues) {
      const severity = category.score === null ? "info" : category.score < 50 ? "critical" : category.score < 80 ? "warning" : "info";
      findings.push({ ruleId: `notification_health_${category.category}`, message: issue, severity });
    }
  }
  return findings;
}

export interface ComputeNotificationHealthInput {
  notifications: Notification[];
  templates: NotificationTemplate[];
  totalMembers: number;
  membersWithConfiguredPreferences: number;
  configuredWorkspaceSettingsCount: number;
  totalWorkspaceSettings: number;
  evaluatedAt: string;
}

export function computeNotificationHealth(input: ComputeNotificationHealthInput): NotificationHealthReport {
  const categories: NotificationHealthCategoryScore[] = [
    computeDeliveryReadinessCategory(),
    computeTemplateCoverageCategory(input.templates),
    computeRoutingHealthCategory(input.notifications),
    computePreferenceHealthCategory(input.totalMembers, input.membersWithConfiguredPreferences),
    computeConfigurationHealthCategory(input.configuredWorkspaceSettingsCount, input.totalWorkspaceSettings),
  ];

  const scored = categories.filter((c): c is NotificationHealthCategoryScore & { score: number } => c.score !== null);
  const overallScore = scored.length === 0 ? 0 : Math.round(scored.reduce((sum, c) => sum + c.score, 0) / scored.length);

  return { categories, overallScore, findings: findingsFromCategories(categories), evaluatedAt: input.evaluatedAt };
}
