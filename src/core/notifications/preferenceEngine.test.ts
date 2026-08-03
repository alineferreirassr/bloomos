import { describe, expect, it } from "vitest";
import { computeNotificationPreferenceDecision, type NotificationWorkspaceDefaults } from "@/core/notifications/preferenceEngine";
import type { NotificationPreferences } from "@/types/communication";

function makePreferences(overrides: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return {
    workspace_id: "ws_1",
    member_id: "member_1",
    desktop_enabled: true,
    in_app_enabled: true,
    email_enabled: true,
    sms_enabled: true,
    push_enabled: true,
    quiet_hours: { enabled: false, startHour: 21, endHour: 8 },
    muted_categories: [],
    minimum_priority: "low",
    digest_frequency: "daily",
    ...overrides,
  };
}

const OPEN_DEFAULTS: NotificationWorkspaceDefaults = { emailEnabled: true, inAppEnabled: true, pushEnabled: true, digestFrequency: "daily", criticalAlertsBypassDigest: true };
const CLOSED_DEFAULTS: NotificationWorkspaceDefaults = { emailEnabled: false, inAppEnabled: true, pushEnabled: false, digestFrequency: "off", criticalAlertsBypassDigest: false };

describe("computeNotificationPreferenceDecision", () => {
  it("enables a channel only when both workspace default and member preference agree", () => {
    const withOpenDefaults = computeNotificationPreferenceDecision(makePreferences(), OPEN_DEFAULTS, "communication", "normal", new Date("2026-06-01T12:00:00"));
    expect(withOpenDefaults.channelsEnabled).toEqual(expect.arrayContaining(["in_app", "email", "push", "sms"]));

    const withClosedWorkspaceDefaults = computeNotificationPreferenceDecision(makePreferences(), CLOSED_DEFAULTS, "communication", "normal", new Date("2026-06-01T12:00:00"));
    expect(withClosedWorkspaceDefaults.channelsEnabled).not.toContain("email");
    expect(withClosedWorkspaceDefaults.channelsEnabled).not.toContain("push");
    // in_app has no workspace-level switch — follows the member's own toggle alone.
    expect(withClosedWorkspaceDefaults.channelsEnabled).toContain("in_app");
    // sms has no workspace-level gate at all in this checkpoint's scope — follows the member's own toggle alone.
    expect(withClosedWorkspaceDefaults.channelsEnabled).toContain("sms");
  });

  it("bypasses the digest for critical notifications when the workspace default says so", () => {
    const decision = computeNotificationPreferenceDecision(makePreferences({ digest_frequency: "weekly" }), OPEN_DEFAULTS, "communication", "critical", new Date("2026-06-01T12:00:00"));
    expect(decision.effectiveDigestFrequency).toBe("off");
  });

  it("keeps the member's own digest frequency when priority isn't critical", () => {
    const decision = computeNotificationPreferenceDecision(makePreferences({ digest_frequency: "weekly" }), OPEN_DEFAULTS, "communication", "normal", new Date("2026-06-01T12:00:00"));
    expect(decision.effectiveDigestFrequency).toBe("weekly");
  });

  it("detects a daytime hour as outside a standard overnight quiet-hours window", () => {
    const decision = computeNotificationPreferenceDecision(
      makePreferences({ quiet_hours: { enabled: true, startHour: 21, endHour: 8 } }),
      OPEN_DEFAULTS,
      "communication",
      "normal",
      new Date(2026, 5, 1, 12, 0, 0),
    );
    expect(decision.withinQuietHours).toBe(false);
  });

  it("detects a late-night hour as inside an overnight quiet-hours window", () => {
    const decision = computeNotificationPreferenceDecision(
      makePreferences({ quiet_hours: { enabled: true, startHour: 21, endHour: 8 } }),
      OPEN_DEFAULTS,
      "communication",
      "normal",
      new Date(2026, 5, 1, 23, 0, 0),
    );
    expect(decision.withinQuietHours).toBe(true);
  });

  it("reports categoryMuted true only when the given category is in muted_categories", () => {
    const decision = computeNotificationPreferenceDecision(makePreferences({ muted_categories: ["finance"] }), OPEN_DEFAULTS, "finance", "normal", new Date());
    expect(decision.categoryMuted).toBe(true);
    const notMuted = computeNotificationPreferenceDecision(makePreferences({ muted_categories: ["finance"] }), OPEN_DEFAULTS, "crm", "normal", new Date());
    expect(notMuted.categoryMuted).toBe(false);
  });

  it("always includes future channel availability for every channel", () => {
    const decision = computeNotificationPreferenceDecision(makePreferences(), OPEN_DEFAULTS, "communication", "normal", new Date());
    expect(decision.futureChannelAvailability.length).toBeGreaterThan(0);
    expect(decision.futureChannelAvailability.find((c) => c.channel === "in_app")?.configured).toBe(true);
  });
});
