import { describe, expect, it } from "vitest";
import { computeNotificationHealth } from "@/core/notifications/notificationHealthEngine";
import { NOTIFICATION_KINDS, type Notification } from "@/core/notifications/types";
import type { NotificationTemplate } from "@/types/notificationPlatform";

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "notification_1",
    workspace_id: "ws_1",
    recipient_member_id: "member_1",
    recipient_client_account_id: null,
    channel: "in_app",
    title: "Test",
    body: "Test body",
    read_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    related_owner_type: null,
    related_owner_id: null,
    kind: "lead_created",
    priority: "normal",
    pinned_at: null,
    archived_at: null,
    ...overrides,
  };
}

function makeTemplates(kinds = NOTIFICATION_KINDS): NotificationTemplate[] {
  return kinds.map((kind, index) => ({
    id: `notification_template_${index}`,
    workspace_id: "ws_1",
    kind,
    name: kind,
    description: "",
    category: "communication",
    defaultPriority: "normal",
    defaultChannel: "in_app",
    titleTemplate: kind,
    bodyTemplate: "",
    version: 1,
    archived_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  }));
}

describe("computeNotificationHealth", () => {
  it("always includes exactly the five named categories", () => {
    const report = computeNotificationHealth({
      notifications: [],
      templates: [],
      totalMembers: 0,
      membersWithConfiguredPreferences: 0,
      configuredWorkspaceSettingsCount: 0,
      totalWorkspaceSettings: 5,
      evaluatedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(report.categories.map((c) => c.category)).toEqual(["delivery_readiness", "template_coverage", "routing_health", "preference_health", "configuration_health"]);
  });

  it("scores delivery_readiness at 25% with only in_app configured (the default)", () => {
    const report = computeNotificationHealth({
      notifications: [],
      templates: [],
      totalMembers: 0,
      membersWithConfiguredPreferences: 0,
      configuredWorkspaceSettingsCount: 0,
      totalWorkspaceSettings: 5,
      evaluatedAt: "2026-06-01T00:00:00.000Z",
    });
    const category = report.categories.find((c) => c.category === "delivery_readiness");
    expect(category?.score).toBe(25);
    expect(category?.issues[0]).toContain("channels have no delivery provider");
  });

  it("scores template_coverage 100 when every kind has an active template", () => {
    const report = computeNotificationHealth({
      notifications: [],
      templates: makeTemplates(),
      totalMembers: 0,
      membersWithConfiguredPreferences: 0,
      configuredWorkspaceSettingsCount: 0,
      totalWorkspaceSettings: 5,
      evaluatedAt: "2026-06-01T00:00:00.000Z",
    });
    const category = report.categories.find((c) => c.category === "template_coverage");
    expect(category?.score).toBe(100);
    expect(category?.issues).toEqual([]);
  });

  it("flags missing kinds in template_coverage when some templates are archived", () => {
    const templates = makeTemplates();
    templates[0].archived_at = "2026-01-02T00:00:00.000Z";
    const report = computeNotificationHealth({
      notifications: [],
      templates,
      totalMembers: 0,
      membersWithConfiguredPreferences: 0,
      configuredWorkspaceSettingsCount: 0,
      totalWorkspaceSettings: 5,
      evaluatedAt: "2026-06-01T00:00:00.000Z",
    });
    const category = report.categories.find((c) => c.category === "template_coverage");
    expect(category?.score).toBeLessThan(100);
    expect(category?.issues[0]).toContain("no active template");
  });

  it("reports routing_health as not-applicable with no notifications", () => {
    const report = computeNotificationHealth({
      notifications: [],
      templates: [],
      totalMembers: 0,
      membersWithConfiguredPreferences: 0,
      configuredWorkspaceSettingsCount: 0,
      totalWorkspaceSettings: 5,
      evaluatedAt: "2026-06-01T00:00:00.000Z",
    });
    const category = report.categories.find((c) => c.category === "routing_health");
    expect(category?.score).toBeNull();
    expect(category?.notApplicableReason).toBeTruthy();
  });

  it("scores routing_health 100 when every notification has exactly one recipient", () => {
    const report = computeNotificationHealth({
      notifications: [makeNotification({ recipient_member_id: "member_1", recipient_client_account_id: null })],
      templates: [],
      totalMembers: 0,
      membersWithConfiguredPreferences: 0,
      configuredWorkspaceSettingsCount: 0,
      totalWorkspaceSettings: 5,
      evaluatedAt: "2026-06-01T00:00:00.000Z",
    });
    const category = report.categories.find((c) => c.category === "routing_health");
    expect(category?.score).toBe(100);
  });

  it("scores preference_health as the ratio of members who've customized their preferences", () => {
    const report = computeNotificationHealth({
      notifications: [],
      templates: [],
      totalMembers: 4,
      membersWithConfiguredPreferences: 1,
      configuredWorkspaceSettingsCount: 0,
      totalWorkspaceSettings: 5,
      evaluatedAt: "2026-06-01T00:00:00.000Z",
    });
    const category = report.categories.find((c) => c.category === "preference_health");
    expect(category?.score).toBe(25);
  });

  it("scores configuration_health as the ratio of workspace-level settings that have an explicit value", () => {
    const report = computeNotificationHealth({
      notifications: [],
      templates: [],
      totalMembers: 0,
      membersWithConfiguredPreferences: 0,
      configuredWorkspaceSettingsCount: 5,
      totalWorkspaceSettings: 5,
      evaluatedAt: "2026-06-01T00:00:00.000Z",
    });
    const category = report.categories.find((c) => c.category === "configuration_health");
    expect(category?.score).toBe(100);
    expect(category?.issues).toEqual([]);
  });

  it("computes overallScore as the average of every non-null category and generates findings from every issue", () => {
    const report = computeNotificationHealth({
      notifications: [],
      templates: [],
      totalMembers: 0,
      membersWithConfiguredPreferences: 0,
      configuredWorkspaceSettingsCount: 0,
      totalWorkspaceSettings: 5,
      evaluatedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.findings.every((f) => f.ruleId.startsWith("notification_health_"))).toBe(true);
  });
});
