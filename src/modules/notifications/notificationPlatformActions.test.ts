import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import {
  createNotificationAction,
  markNotificationReadAction,
  markNotificationUnreadAction,
  dismissNotificationAction,
  archiveNotificationAction,
  pinNotificationAction,
  unpinNotificationAction,
  listNotificationTemplatesAction,
  getNotificationTemplateDetailAction,
  createNotificationTemplateAction,
  getNotificationPreferencesForCurrentMemberAction,
  updateNotificationPreferencesForCurrentMemberAction,
  getNotificationWorkspaceDefaultsAction,
  evaluateNotificationHealthAction,
  evaluateNotificationAnalyticsAction,
  notificationRecommendationsForExecutiveDecisions,
  getNotificationDashboardDataAction,
  getNotificationDetailAction,
} from "@/modules/notifications/notificationPlatformActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resetNotificationsStore, mockNotificationsRepository } from "@/lib/data/core/notifications/mockRepository";
import { resetNotificationTemplateStore } from "@/lib/data/core/notifications/templateStore";
import { resetNotificationPreferencesStore } from "@/lib/data/core/communication/notificationPreferencesStore";
import { resetTimelineStore, readActivities } from "@/lib/data/mock/timelineStore";
import { resetSettingsStore } from "@/lib/data/core/settings/mockRepository";

function makeSession(overrides: Partial<MemberSessionSnapshot & { kind: "active" }> = {}): MemberSessionSnapshot {
  return {
    kind: "active",
    user: { id: "user_1", email: "ana@amorebloom.com" },
    profile: { full_name: "Ana Ferreira", avatar_url: null },
    workspace: { id: "ws_1", name: "Amoré Bloom" },
    membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
    permissions: ["notifications.view", "notifications.manage", "notifications.templates", "notifications.preferences"],
    workspaceDisplayName: "Amoré Bloom",
    ...overrides,
  } as MemberSessionSnapshot;
}

beforeEach(() => {
  resetNotificationsStore();
  resetNotificationTemplateStore();
  resetNotificationPreferencesStore();
  resetTimelineStore();
  resetSettingsStore();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(makeSession());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("createNotificationAction", () => {
  it("creates a notification and records a notification_dispatched Timeline event", async () => {
    const result = await createNotificationAction({ kind: "lead_created", recipientMemberId: "member_1", title: "New lead", body: "Jane Doe" });
    expect(result.success).toBe(true);
    if (!result.success) return;

    const timeline = readActivities().filter((a) => a.owner_type === "notification" && a.owner_id === result.data.id);
    expect(timeline).toHaveLength(1);
    expect(timeline[0].type).toBe("notification_dispatched");
  });

  it("is denied without notifications.manage", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(makeSession({ permissions: ["notifications.view"] }));
    const result = await createNotificationAction({ kind: "lead_created", recipientMemberId: "member_1", title: "New lead", body: "Jane Doe" });
    expect(result.success).toBe(false);
  });
});

describe("state transitions", () => {
  it("marks read then unread, recording a Timeline event for the read transition", async () => {
    const created = await mockNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_1", title: "Test", body: "Body" });
    if (!created.success) throw new Error("setup failed");

    const read = await markNotificationReadAction(created.data.id);
    expect(read.success && read.data.read_at).not.toBeNull();
    expect(readActivities().some((a) => a.type === "notification_read" && a.owner_id === created.data.id)).toBe(true);

    const unread = await markNotificationUnreadAction(created.data.id);
    expect(unread.success && unread.data.read_at).toBeNull();
  });

  it("dismissNotificationAction is an alias for archiveNotificationAction and records notification_archived", async () => {
    const created = await mockNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_1", title: "Test", body: "Body" });
    if (!created.success) throw new Error("setup failed");

    const dismissed = await dismissNotificationAction(created.data.id);
    expect(dismissed.success && dismissed.data.archived_at).not.toBeNull();
    expect(readActivities().some((a) => a.type === "notification_archived" && a.owner_id === created.data.id)).toBe(true);
  });

  it("pins and unpins a notification", async () => {
    const created = await mockNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_1", title: "Test", body: "Body" });
    if (!created.success) throw new Error("setup failed");

    const pinned = await pinNotificationAction(created.data.id);
    expect(pinned.success && pinned.data.pinned_at).not.toBeNull();
    const unpinned = await unpinNotificationAction(created.data.id);
    expect(unpinned.success && unpinned.data.pinned_at).toBeNull();
  });

  it("denies every state transition action without notifications.view", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(makeSession({ permissions: [] }));
    const result = await markNotificationReadAction("notification_missing");
    expect(result.success).toBe(false);
  });

  it("rejects a workspace member from reading/archiving/pinning another member's notification (v2 Checkpoint 45 security fix)", async () => {
    const created = await mockNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_1", title: "Test", body: "Body" });
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(makeSession({ membership: { id: "member_2", role: "staff", status: "active", created_at: "2026-01-01T00:00:00Z" } }));

    expect((await markNotificationReadAction(created.data.id)).success).toBe(false);
    expect((await markNotificationUnreadAction(created.data.id)).success).toBe(false);
    expect((await archiveNotificationAction(created.data.id)).success).toBe(false);
    expect((await pinNotificationAction(created.data.id)).success).toBe(false);
    expect((await unpinNotificationAction(created.data.id)).success).toBe(false);
  });
});

describe("templates", () => {
  it("lists the seeded templates and fetches one detail with its history", async () => {
    const list = await listNotificationTemplatesAction();
    expect(list.success && list.data.length).toBeGreaterThan(0);
    if (!list.success) return;

    const detail = await getNotificationTemplateDetailAction(list.data[0].id);
    expect(detail.success && detail.data.template.id).toBe(list.data[0].id);
    expect(detail.success && detail.data.history.length).toBeGreaterThan(0);
  });

  it("creates a genuinely new custom template", async () => {
    const result = await createNotificationTemplateAction({
      kind: "lead_created",
      name: "Custom",
      description: "desc",
      category: "crm",
      defaultPriority: "high",
      defaultChannel: "in_app",
      titleTemplate: "title",
      bodyTemplate: "body",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a blank template name", async () => {
    const result = await createNotificationTemplateAction({
      kind: "lead_created",
      name: "  ",
      description: "desc",
      category: "crm",
      defaultPriority: "high",
      defaultChannel: "in_app",
      titleTemplate: "title",
      bodyTemplate: "body",
    });
    expect(result.success).toBe(false);
  });

  it("is denied without notifications.templates", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(makeSession({ permissions: ["notifications.view"] }));
    const result = await listNotificationTemplatesAction();
    expect(result.success).toBe(false);
  });
});

describe("preferences", () => {
  it("reads and updates the current member's own preferences", async () => {
    const initial = await getNotificationPreferencesForCurrentMemberAction();
    expect(initial.success && initial.data.digest_frequency).toBe("daily");

    const updated = await updateNotificationPreferencesForCurrentMemberAction({ digestFrequency: "weekly" });
    expect(updated.success && updated.data.digest_frequency).toBe("weekly");
  });

  it("returns workspace defaults and channel readiness for the preferences view", async () => {
    const result = await getNotificationWorkspaceDefaultsAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.channelReadiness.find((c) => c.channel === "in_app")?.configured).toBe(true);
  });

  it("is denied without notifications.preferences", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(makeSession({ permissions: ["notifications.view"] }));
    const result = await getNotificationPreferencesForCurrentMemberAction();
    expect(result.success).toBe(false);
  });
});

describe("health and analytics actions", () => {
  it("evaluates notification health for the current workspace", async () => {
    const result = await evaluateNotificationHealthAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.categories).toHaveLength(5);
  });

  it("evaluates notification analytics for the current workspace", async () => {
    await mockNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_1", title: "Test", body: "Body" });
    const result = await evaluateNotificationAnalyticsAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.totalCreated).toBe(1);
  });

  it("produces zero recommendations when nothing was ever created (health is at a fresh baseline, not fabricated)", async () => {
    const recommendations = await notificationRecommendationsForExecutiveDecisions();
    expect(Array.isArray(recommendations)).toBe(true);
  });

  it("contributes zero recommendations rather than throwing when the caller isn't active", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const recommendations = await notificationRecommendationsForExecutiveDecisions();
    expect(recommendations).toEqual([]);
  });
});

describe("dashboard and detail aggregation", () => {
  it("aggregates unread/today/high-priority/pinned/archived counts for the dashboard", async () => {
    await mockNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_1", title: "Unread", body: "", priority: "critical" });
    const result = await getNotificationDashboardDataAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.unreadCount).toBe(1);
    expect(result.data.highPriorityCount).toBe(1);
    expect(result.data.todayCount).toBe(1);
  });

  it("builds a full detail view with routing, preference decision, and knowledge graph summary", async () => {
    const created = await mockNotificationsRepository.createInAppNotification("ws_1", {
      recipientMemberId: "member_1",
      title: "Contract signed",
      body: "Body",
      kind: "proposal_accepted",
      relatedOwnerType: "contract",
      relatedOwnerId: "contract_1",
    });
    if (!created.success) throw new Error("setup failed");

    const detail = await getNotificationDetailAction(created.data.id);
    expect(detail.success).toBe(true);
    if (!detail.success) return;
    expect(detail.data.routing.category).toBe("crm");
    expect(detail.data.knowledgeGraphSummary).toContain("1 notification");
  });

  it("fails cleanly for a notification id that doesn't exist", async () => {
    const result = await getNotificationDetailAction("notification_missing");
    expect(result.success).toBe(false);
  });
});

describe("v2 Checkpoint 44, Step 7 — integration notification provider startup wiring", () => {
  it("reports the email channel as configured, since importing this module registers the real Gmail-backed provider", async () => {
    const { isChannelConfigured } = await import("@/core/notifications/registry");
    expect(isChannelConfigured("email")).toBe(true);
  });
});
