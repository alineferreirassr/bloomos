"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getCoreNotificationsService, listNotificationTemplates, getNotificationTemplate, getNotificationTemplateHistory, createNotificationTemplate, type CreateNotificationTemplateInput } from "@/core/notifications";
import { buildNotificationInput, NOTIFICATION_KIND_META, type BuildNotificationParams } from "@/core/communication/notificationEngine";
import { computeNotificationRouting } from "@/core/notifications/routingEngine";
import { isChannelConfigured } from "@/core/notifications/registry";
import { NOTIFICATION_CHANNELS } from "@/core/notifications/types";
import { computeNotificationPreferenceDecision, type NotificationWorkspaceDefaults, type NotificationPreferenceDecision } from "@/core/notifications/preferenceEngine";
import { computeNotificationHealth } from "@/core/notifications/notificationHealthEngine";
import { computeNotificationAnalytics } from "@/core/notifications/notificationAnalyticsEngine";
import { buildNotificationTimelineEvent, type NotificationTimelineTransition } from "@/core/notifications/notificationTimelineEngine";
import { notificationHealthToRecommendations } from "@/core/notifications/executiveIntegration";
import { computeNotificationActivityForNode, generateNotificationActivitySummary } from "@/core/notifications/knowledgeGraphIntegration";
import { resolveNotificationTemplate, findUnknownEmailTemplatePlaceholders, type ResolvedNotificationContent } from "@/core/notifications/emailTemplateEngine";
import { registerIntegrationNotificationProviders } from "@/modules/integrations/notificationDeliveryProviders";
import { mockNotificationPreferencesRepository, type UpdatePreferencesInput } from "@/lib/data/core/communication/notificationPreferencesStore";
import { countConfiguredPreferences } from "@/lib/data/core/communication/notificationPreferencesStore";
import { notificationsSettings } from "@/modules/settings/sections/notificationsSection";
import { getSettingsManager } from "@/core/settings/manager";
import { recordTimelineActivity, readActivities } from "@/lib/data/mock/timelineStore";
import { getWorkspaceMembers } from "@/lib/data";
import { nowIso } from "@/lib/data/utils";
import type { DataResult } from "@/lib/data/result";
import type { Notification } from "@/core/notifications/types";
import type { NotificationTemplate } from "@/types/notificationPlatform";
import type { NotificationHealthReport } from "@/types/notificationHealth";
import type { NotificationAnalytics } from "@/types/notificationAnalytics";
import type { NotificationPreferences } from "@/types/communication";
import type { OperationalRecommendation } from "@/types/businessHealth";
import type { MergeContext } from "@/types/documentPlatform";

/**
 * v2.0 Checkpoint 41, Step 11 — Notification Platform module actions. The
 * single new-namespace entry point for everything this checkpoint added.
 * Deliberately additive to `modules/communication/notifications/notificationActions.ts`
 * and `modules/communication/preferences/preferencesActions.ts`
 * (Checkpoint 24) — those keep working unchanged, gated on
 * `communications.view`; every action here gates on the new, more granular
 * `notifications.*` permissions (Step 12) and, where it wraps the same
 * underlying repository call (mark read/archive/pin), also records the new
 * Timeline events (Step 8) those older actions never did.
 */

// v2 Checkpoint 44, Step 7 — the same idempotent self-registration convention `registerDocumentTypes()`/`registerMergeFields()`
// already use in `modules/documentTemplates/*`: `registerIntegrationNotificationProviders()` (Checkpoint 43) was written but
// never actually called anywhere outside its own test, so `isChannelConfigured("email")` reported `false` in every real
// delivery-readiness check. Called here, at the top of the one module-actions file every Notification Platform surface
// (dashboard, health report, routing) is imported through, so it has always run before any of those read the registry.
registerIntegrationNotificationProviders();

const GENERIC_ACCESS_ERROR = "Notifications aren't available. You may not have access to them.";

function requireNotificationsView(session: Awaited<ReturnType<typeof resolveMemberSessionSnapshot>>): session is Extract<typeof session, { kind: "active" }> {
  return session.kind === "active" && session.permissions.includes("notifications.view");
}

async function resolveWorkspaceDefaults(workspaceId: string): Promise<NotificationWorkspaceDefaults> {
  const [emailEnabled, pushEnabled, digestFrequency, criticalAlertsBypassDigest] = await Promise.all([
    getSettingsManager().getResolvedSettingValue(workspaceId, "notifications.email-enabled"),
    getSettingsManager().getResolvedSettingValue(workspaceId, "notifications.push-enabled"),
    getSettingsManager().getResolvedSettingValue(workspaceId, "notifications.digest-frequency"),
    getSettingsManager().getResolvedSettingValue(workspaceId, "notifications.critical-alerts-bypass-digest"),
  ]);
  return {
    emailEnabled: Boolean(emailEnabled),
    inAppEnabled: true,
    pushEnabled: Boolean(pushEnabled),
    digestFrequency: (digestFrequency as NotificationWorkspaceDefaults["digestFrequency"]) ?? "daily",
    criticalAlertsBypassDigest: Boolean(criticalAlertsBypassDigest),
  };
}

function recordNotificationTimelineEvent(workspaceId: string, notification: Notification, transition: NotificationTimelineTransition): void {
  const event = buildNotificationTimelineEvent(notification, transition);
  recordTimelineActivity(workspaceId, "notification", event.ownerId, event.type, event.description);
}

/** Confirms `id` is really one of the caller's own notifications before any state-transition mutation touches it — mirrors `markAllNotificationsRead`'s own `workspace_id`+`recipient_member_id` scoping, which the single-id mutations below never had. */
async function requireOwnedNotification(id: string, workspaceId: string, memberId: string): Promise<Notification | null> {
  const own = await getCoreNotificationsService().getNotificationsForMember(workspaceId, memberId);
  return own.find((n) => n.id === id) ?? null;
}

// --- Create / state transitions -------------------------------------------------

export type CreateNotificationActionInput = BuildNotificationParams;

/** Gated on `notifications.manage` (not `.view`) — creating a notification on behalf of a recipient is a workspace-wide write, the same "narrower gate for the mutating action" split every other permission pair here uses. Wraps the same real write path (`getCoreNotificationsService().createInAppNotification()`) `modules/automation/actions/createNotificationAction.ts` already uses — never a second notification store. */
export async function createNotificationAction(input: CreateNotificationActionInput): Promise<DataResult<Notification>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("notifications.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await getCoreNotificationsService().createInAppNotification(session.workspace.id, buildNotificationInput(input));
  if (result.success) recordNotificationTimelineEvent(session.workspace.id, result.data, "dispatched");
  return result;
}

export async function markNotificationReadAction(id: string): Promise<DataResult<Notification>> {
  const session = await resolveMemberSessionSnapshot();
  if (!requireNotificationsView(session)) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!(await requireOwnedNotification(id, session.workspace.id, session.membership.id))) return { success: false, error: "Notification not found." };
  const result = await getCoreNotificationsService().markNotificationRead(id);
  if (result.success) recordNotificationTimelineEvent(session.workspace.id, result.data, "read");
  return result;
}

export async function markNotificationUnreadAction(id: string): Promise<DataResult<Notification>> {
  const session = await resolveMemberSessionSnapshot();
  if (!requireNotificationsView(session)) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!(await requireOwnedNotification(id, session.workspace.id, session.membership.id))) return { success: false, error: "Notification not found." };
  return getCoreNotificationsService().markNotificationUnread(id);
}

/** Named to match the checkpoint's own vocabulary — an honest alias for `archiveNotificationAction`; see `notificationAnalyticsEngine.ts`'s own doc comment on why `Notification` has no separate `dismissed_at` state. */
export async function dismissNotificationAction(id: string): Promise<DataResult<Notification>> {
  return archiveNotificationAction(id);
}

export async function archiveNotificationAction(id: string): Promise<DataResult<Notification>> {
  const session = await resolveMemberSessionSnapshot();
  if (!requireNotificationsView(session)) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!(await requireOwnedNotification(id, session.workspace.id, session.membership.id))) return { success: false, error: "Notification not found." };
  const result = await getCoreNotificationsService().archiveNotification(id);
  if (result.success) recordNotificationTimelineEvent(session.workspace.id, result.data, "archived");
  return result;
}

export async function pinNotificationAction(id: string): Promise<DataResult<Notification>> {
  const session = await resolveMemberSessionSnapshot();
  if (!requireNotificationsView(session)) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!(await requireOwnedNotification(id, session.workspace.id, session.membership.id))) return { success: false, error: "Notification not found." };
  return getCoreNotificationsService().pinNotification(id);
}

export async function unpinNotificationAction(id: string): Promise<DataResult<Notification>> {
  const session = await resolveMemberSessionSnapshot();
  if (!requireNotificationsView(session)) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!(await requireOwnedNotification(id, session.workspace.id, session.membership.id))) return { success: false, error: "Notification not found." };
  return getCoreNotificationsService().unpinNotification(id);
}

// --- Templates --------------------------------------------------------------

export async function listNotificationTemplatesAction(): Promise<DataResult<NotificationTemplate[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("notifications.templates")) return { success: false, error: GENERIC_ACCESS_ERROR };
  return { success: true, data: listNotificationTemplates(session.workspace.id) };
}

export interface NotificationTemplateDetail {
  template: NotificationTemplate;
  history: ReturnType<typeof getNotificationTemplateHistory>;
}

export async function getNotificationTemplateDetailAction(id: string): Promise<DataResult<NotificationTemplateDetail>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("notifications.templates")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const template = getNotificationTemplate(session.workspace.id, id);
  if (!template) return { success: false, error: "Template not found." };
  return { success: true, data: { template, history: getNotificationTemplateHistory(id) } };
}

/** Gated on `notifications.templates`. Real infrastructure — see `templateStore.ts`'s own doc comment on why this checkpoint's Template Library UI (Step 16) still renders read-only. */
export async function createNotificationTemplateAction(input: CreateNotificationTemplateInput): Promise<DataResult<NotificationTemplate>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("notifications.templates")) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (input.name.trim().length === 0) return { success: false, error: "Please fix the highlighted fields.", fieldErrors: { name: "Name is required" } };
  return { success: true, data: createNotificationTemplate(session.workspace.id, input) };
}

/** v2 Checkpoint 44, Step 8 — the Email Template Library's own preview action. Resolves a stored `NotificationTemplate`'s `{{key}}` placeholders against real data for `clientId`/`eventId`/etc, and flags any placeholder that isn't a registered Merge Field so an author catches a typo before it ever reaches a real inbox. Gated on `notifications.templates`, same as authoring itself. */
export async function previewNotificationTemplateAction(
  id: string,
  contextOverrides: Omit<MergeContext, "workspaceId" | "memberId">,
): Promise<DataResult<ResolvedNotificationContent & { unknownPlaceholders: string[] }>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("notifications.templates")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const template = getNotificationTemplate(session.workspace.id, id);
  if (!template) return { success: false, error: "Template not found." };

  const context: MergeContext = { workspaceId: session.workspace.id, memberId: session.membership.id, ...contextOverrides };
  const resolved = await resolveNotificationTemplate(template, context);
  return { success: true, data: { ...resolved, unknownPlaceholders: findUnknownEmailTemplatePlaceholders(template) } };
}

// --- Preferences --------------------------------------------------------------

export async function getNotificationPreferencesForCurrentMemberAction(): Promise<DataResult<NotificationPreferences>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("notifications.preferences")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const preferences = await mockNotificationPreferencesRepository.getPreferences(session.workspace.id, session.membership.id);
  return { success: true, data: preferences };
}

export async function updateNotificationPreferencesForCurrentMemberAction(input: UpdatePreferencesInput): Promise<DataResult<NotificationPreferences>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("notifications.preferences")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const updated = await mockNotificationPreferencesRepository.updatePreferences(session.workspace.id, session.membership.id, input);
  return { success: true, data: updated };
}

export interface NotificationWorkspaceDefaultsView {
  workspaceDefaults: NotificationWorkspaceDefaults;
  channelReadiness: ReturnType<typeof computeNotificationRouting>["deliveryReadiness"];
}

/** Read-only summary for the Preferences view's "Workspace preferences" and "Future integrations status" sections — editing the workspace-level defaults themselves stays on `/settings` (`workspace.manage`), not here. */
export async function getNotificationWorkspaceDefaultsAction(): Promise<DataResult<NotificationWorkspaceDefaultsView>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("notifications.preferences")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceDefaults = await resolveWorkspaceDefaults(session.workspace.id);
  const channelReadiness = NOTIFICATION_CHANNELS.map((channel) => ({
    channel,
    configured: isChannelConfigured(channel),
    reason: isChannelConfigured(channel) ? null : "No delivery provider registered for this channel yet.",
  }));
  return { success: true, data: { workspaceDefaults, channelReadiness } };
}

export async function getNotificationPreferenceDecisionAction(notificationId: string): Promise<DataResult<NotificationPreferenceDecision>> {
  const session = await resolveMemberSessionSnapshot();
  if (!requireNotificationsView(session)) return { success: false, error: GENERIC_ACCESS_ERROR };
  const notifications = await getCoreNotificationsService().getNotificationsForMember(session.workspace.id, session.membership.id);
  const notification = notifications.find((n) => n.id === notificationId);
  if (!notification) return { success: false, error: "Notification not found." };

  const [preferences, workspaceDefaults] = await Promise.all([
    mockNotificationPreferencesRepository.getPreferences(session.workspace.id, session.membership.id),
    resolveWorkspaceDefaults(session.workspace.id),
  ]);
  const category = notification.kind ? NOTIFICATION_KIND_META[notification.kind].defaultCategory : "communication";
  return { success: true, data: computeNotificationPreferenceDecision(preferences, workspaceDefaults, category, notification.priority, new Date()) };
}

// --- Health / Analytics --------------------------------------------------------

async function fetchWorkspaceHealthInputs(workspaceId: string) {
  const [notifications, workspaceMembers] = await Promise.all([getCoreNotificationsService().getMemberNotificationsForWorkspace(workspaceId), getWorkspaceMembers()]);
  const templates = listNotificationTemplates(workspaceId);
  const configuredWorkspaceSettingsCount = (
    await Promise.all(notificationsSettings.map((setting) => getSettingsManager().getSettingValue(workspaceId, setting.id)))
  ).filter((value) => value !== undefined).length;
  return { notifications, templates, totalMembers: workspaceMembers.length, configuredWorkspaceSettingsCount };
}

export async function evaluateNotificationHealthAction(): Promise<DataResult<NotificationHealthReport>> {
  const session = await resolveMemberSessionSnapshot();
  if (!requireNotificationsView(session)) return { success: false, error: GENERIC_ACCESS_ERROR };
  const now = nowIso();
  const { notifications, templates, totalMembers, configuredWorkspaceSettingsCount } = await fetchWorkspaceHealthInputs(session.workspace.id);
  const report = computeNotificationHealth({
    notifications,
    templates,
    totalMembers,
    membersWithConfiguredPreferences: countConfiguredPreferences(session.workspace.id),
    configuredWorkspaceSettingsCount,
    totalWorkspaceSettings: notificationsSettings.length,
    evaluatedAt: now,
  });
  return { success: true, data: report };
}

export async function evaluateNotificationAnalyticsAction(): Promise<DataResult<NotificationAnalytics>> {
  const session = await resolveMemberSessionSnapshot();
  if (!requireNotificationsView(session)) return { success: false, error: GENERIC_ACCESS_ERROR };
  const notifications = await getCoreNotificationsService().getMemberNotificationsForWorkspace(session.workspace.id);
  return { success: true, data: computeNotificationAnalytics(notifications, nowIso()) };
}

/** Bare `OperationalRecommendation[]`, the same `xRecommendationsForExecutiveDecisions()` return shape every sibling (`searchRecommendationsForExecutiveDecisions`, `workflowRecommendationsForExecutiveDecisions`, etc.) already uses — `executiveDecisionsActions.ts` wraps it in its own `{ generatedBy, recommendations }` `RecommendationSource` at the call site, never here. */
export async function notificationRecommendationsForExecutiveDecisions(): Promise<OperationalRecommendation[]> {
  const healthResult = await evaluateNotificationHealthActionForWorkspace();
  if (!healthResult) return [];
  return notificationHealthToRecommendations(healthResult.report, healthResult.workspaceId);
}

/** Internal helper — `notificationRecommendationsForExecutiveDecisions()` needs the health report for whichever workspace the *current* session belongs to, the same "resolve from session, never take a workspaceId param" discipline every other `xRecommendationsForExecutiveDecisions()` sibling function already follows. Returns `null` (rather than failing loudly) for the same reason those siblings do: a signed-out/inactive caller should contribute zero findings, not block Executive Decision evaluation for everyone else. */
async function evaluateNotificationHealthActionForWorkspace(): Promise<{ report: NotificationHealthReport; workspaceId: string } | null> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return null;
  const now = nowIso();
  const { notifications, templates, totalMembers, configuredWorkspaceSettingsCount } = await fetchWorkspaceHealthInputs(session.workspace.id);
  const report = computeNotificationHealth({
    notifications,
    templates,
    totalMembers,
    membersWithConfiguredPreferences: countConfiguredPreferences(session.workspace.id),
    configuredWorkspaceSettingsCount,
    totalWorkspaceSettings: notificationsSettings.length,
    evaluatedAt: now,
  });
  return { report, workspaceId: session.workspace.id };
}

// --- Dashboard / Detail aggregation --------------------------------------------

export interface NotificationDashboardData {
  notifications: Notification[];
  unreadCount: number;
  todayCount: number;
  highPriorityCount: number;
  pinnedCount: number;
  archivedCount: number;
  templates: NotificationTemplate[];
  recentActivity: ReturnType<typeof readActivities>;
}

export async function getNotificationDashboardDataAction(): Promise<DataResult<NotificationDashboardData>> {
  const session = await resolveMemberSessionSnapshot();
  if (!requireNotificationsView(session)) return { success: false, error: GENERIC_ACCESS_ERROR };

  const notifications = await getCoreNotificationsService().getNotificationsForMember(session.workspace.id, session.membership.id);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return {
    success: true,
    data: {
      notifications,
      unreadCount: notifications.filter((n) => n.read_at === null && n.archived_at === null).length,
      todayCount: notifications.filter((n) => new Date(n.created_at).getTime() >= startOfToday.getTime()).length,
      highPriorityCount: notifications.filter((n) => (n.priority === "high" || n.priority === "critical") && n.archived_at === null).length,
      pinnedCount: notifications.filter((n) => n.pinned_at !== null).length,
      archivedCount: notifications.filter((n) => n.archived_at !== null).length,
      templates: listNotificationTemplates(session.workspace.id),
      recentActivity: readActivities()
        .filter((a) => a.workspace_id === session.workspace.id && a.owner_type === "notification" && notifications.some((n) => n.id === a.owner_id))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, 20),
    },
  };
}

export interface NotificationDetailData {
  notification: Notification;
  routing: ReturnType<typeof computeNotificationRouting>;
  preferenceDecision: NotificationPreferenceDecision;
  template: NotificationTemplate | null;
  timeline: ReturnType<typeof readActivities>;
  knowledgeGraphSummary: string;
}

export async function getNotificationDetailAction(id: string): Promise<DataResult<NotificationDetailData>> {
  const session = await resolveMemberSessionSnapshot();
  if (!requireNotificationsView(session)) return { success: false, error: GENERIC_ACCESS_ERROR };

  const notifications = await getCoreNotificationsService().getNotificationsForMember(session.workspace.id, session.membership.id);
  const notification = notifications.find((n) => n.id === id);
  if (!notification) return { success: false, error: "Notification not found." };

  const [preferences, workspaceDefaults] = await Promise.all([
    mockNotificationPreferencesRepository.getPreferences(session.workspace.id, session.membership.id),
    resolveWorkspaceDefaults(session.workspace.id),
  ]);
  const category = notification.kind ? NOTIFICATION_KIND_META[notification.kind].defaultCategory : "communication";
  const routing = computeNotificationRouting(notification, preferences);
  const preferenceDecision = computeNotificationPreferenceDecision(preferences, workspaceDefaults, category, notification.priority, new Date());
  const template = notification.kind
    ? (listNotificationTemplates(session.workspace.id).find((t) => t.kind === notification.kind) ?? null)
    : null;
  const timeline = readActivities()
    .filter((a) => a.workspace_id === session.workspace.id && a.owner_type === "notification" && a.owner_id === notification.id)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const knowledgeGraphSummary =
    notification.related_owner_type && notification.related_owner_id
      ? generateNotificationActivitySummary(
          computeNotificationActivityForNode({ nodeType: notification.related_owner_type, nodeId: notification.related_owner_id }, notifications),
        )
      : "This notification isn't linked to another record.";

  return { success: true, data: { notification, routing, preferenceDecision, template, timeline, knowledgeGraphSummary } };
}
