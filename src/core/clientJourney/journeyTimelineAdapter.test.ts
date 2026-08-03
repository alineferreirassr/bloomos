import { describe, it, expect } from "vitest";
import { mergeJourneyTimeline } from "./journeyTimelineAdapter";
import type { ActivityEntry } from "@/types/communication";

function entry(overrides: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    id: "e1",
    workspaceId: "workspace_1",
    category: "crm",
    kind: "lead_created",
    title: "Lead created",
    description: null,
    actorLabel: "System",
    actorMemberId: null,
    occurredAt: "2026-01-01T00:00:00.000Z",
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
    ...overrides,
  } as ActivityEntry;
}

describe("mergeJourneyTimeline", () => {
  it("merges multiple owner-scoped entry groups into one chronological list", () => {
    const merged = mergeJourneyTimeline([
      [entry({ id: "a", occurredAt: "2026-01-01T00:00:00.000Z" })],
      [entry({ id: "b", occurredAt: "2026-01-03T00:00:00.000Z" })],
      [entry({ id: "c", occurredAt: "2026-01-02T00:00:00.000Z" })],
    ]);
    expect(merged.map((e) => e.id)).toEqual(["b", "c", "a"]);
  });

  it("dedupes an entry that appears in more than one group by id", () => {
    const shared = entry({ id: "dup" });
    const merged = mergeJourneyTimeline([[shared], [shared]]);
    expect(merged).toHaveLength(1);
  });

  it("returns an empty list when every group is empty", () => {
    expect(mergeJourneyTimeline([[], []])).toEqual([]);
  });
});
