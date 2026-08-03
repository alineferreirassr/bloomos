import { describe, expect, it } from "vitest";
import { summarizeActivityFeed } from "@/core/workspace/activityFeedEngine";
import type { ActivityEntry } from "@/types/smartWorkspace";

function entry(overrides: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    id: "activity_1",
    workspaceId: "ws_1",
    category: "crm",
    kind: "lead_created",
    title: "New lead: Jane Doe",
    description: null,
    actorLabel: "Ana Ferreira",
    actorMemberId: "member_1",
    occurredAt: "2026-01-01T10:00:00Z",
    ownerType: "lead",
    ownerId: "lead_1",
    relatedAutomationExecutionId: null,
    relatedWorkflowId: null,
    relatedDocumentId: null,
    relatedPaymentId: null,
    relatedReminderId: null,
    relatedNotificationId: null,
    deepLink: null,
    pinned: false,
    bookmarked: false,
    ...overrides,
  };
}

describe("activityFeedEngine.summarizeActivityFeed", () => {
  it("returns a zeroed digest for an empty feed", () => {
    const digest = summarizeActivityFeed([]);
    expect(digest).toEqual({ totalEvents: 0, byDay: [], byCategory: {}, mostActiveCategory: null });
  });

  it("groups by day and by category, and finds the most active category", () => {
    const entries = [
      entry({ id: "1", occurredAt: "2026-01-01T09:00:00Z", category: "crm" }),
      entry({ id: "2", occurredAt: "2026-01-01T15:00:00Z", category: "crm" }),
      entry({ id: "3", occurredAt: "2026-01-02T09:00:00Z", category: "finance" }),
    ];

    const digest = summarizeActivityFeed(entries);
    expect(digest.totalEvents).toBe(3);
    expect(digest.byCategory).toEqual({ crm: 2, finance: 1 });
    expect(digest.mostActiveCategory).toBe("crm");
    expect(digest.byDay).toEqual(
      expect.arrayContaining([
        { date: "2026-01-01", count: 2 },
        { date: "2026-01-02", count: 1 },
      ]),
    );
  });
});
