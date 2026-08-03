import { afterEach, describe, expect, it } from "vitest";
import { registerActivitySource, resetActivityRegistry } from "@/core/communication/activityRegistry";
import { aggregateActivity } from "@/core/communication/activityAggregator";
import type { ActivityEntry } from "@/types/communication";

function makeEntry(overrides: Partial<ActivityEntry>): ActivityEntry {
  return {
    id: "entry_1",
    workspaceId: "ws_1",
    category: "communication",
    kind: "comment_created",
    title: "Added a comment",
    description: "Hello",
    actorLabel: "Ana Ferreira",
    actorMemberId: "member_1",
    occurredAt: "2026-07-15T12:00:00.000Z",
    ownerType: null,
    ownerId: null,
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

afterEach(() => {
  resetActivityRegistry();
});

describe("aggregateActivity", () => {
  it("merges every registered source and sorts descending by occurredAt", async () => {
    registerActivitySource("a", async () => [makeEntry({ id: "a1", occurredAt: "2026-07-14T12:00:00.000Z" })]);
    registerActivitySource("b", async () => [makeEntry({ id: "b1", occurredAt: "2026-07-16T12:00:00.000Z" })]);

    const entries = await aggregateActivity({ workspaceId: "ws_1" });
    expect(entries.map((e) => e.id)).toEqual(["b1", "a1"]);
  });

  it("pinned entries always sort first, regardless of recency", async () => {
    registerActivitySource("a", async () => [makeEntry({ id: "old-pinned", occurredAt: "2026-01-01T00:00:00.000Z", pinned: true }), makeEntry({ id: "new", occurredAt: "2026-07-20T00:00:00.000Z" })]);

    const entries = await aggregateActivity({ workspaceId: "ws_1" });
    expect(entries[0].id).toBe("old-pinned");
  });

  it("isolates one adapter's failure — the rest still return results", async () => {
    registerActivitySource("broken", async () => {
      throw new Error("boom");
    });
    registerActivitySource("ok", async () => [makeEntry({ id: "ok1" })]);

    const entries = await aggregateActivity({ workspaceId: "ws_1" });
    expect(entries.map((e) => e.id)).toEqual(["ok1"]);
  });

  it("filters by category", async () => {
    registerActivitySource("a", async () => [makeEntry({ id: "crm1", category: "crm" }), makeEntry({ id: "fin1", category: "finance" })]);

    const entries = await aggregateActivity({ workspaceId: "ws_1", categories: ["crm"] });
    expect(entries.map((e) => e.id)).toEqual(["crm1"]);
  });

  it("filters by free-text search across title and description", async () => {
    registerActivitySource("a", async () => [makeEntry({ id: "match", title: "Invoice overdue" }), makeEntry({ id: "no-match", title: "Unrelated" })]);

    const entries = await aggregateActivity({ workspaceId: "ws_1", search: "overdue" });
    expect(entries.map((e) => e.id)).toEqual(["match"]);
  });

  it("filters by date range", async () => {
    registerActivitySource("a", async () => [makeEntry({ id: "early", occurredAt: "2026-01-01T00:00:00.000Z" }), makeEntry({ id: "within", occurredAt: "2026-07-15T00:00:00.000Z" })]);

    const entries = await aggregateActivity({ workspaceId: "ws_1", dateFrom: "2026-06-01T00:00:00.000Z" });
    expect(entries.map((e) => e.id)).toEqual(["within"]);
  });
});
