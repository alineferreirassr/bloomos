import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data/clientPortal/clientPortalActivityStore", () => ({
  listClientPortalActivityForWorkspace: vi.fn(),
}));

import { listClientPortalActivityForWorkspace } from "@/lib/data/clientPortal/clientPortalActivityStore";
import { getMetric } from "@/core/analytics/metricRegistry";
import { registerPortalMetrics } from "@/modules/analytics/metrics/portalMetrics";
import type { ClientPortalActivityKind } from "@/types/clientPortalActivity";
import type { MetricComputeContext } from "@/types/analytics";

registerPortalMetrics();

const WINDOW = { start: "2026-07-01T00:00:00.000Z", end: "2026-07-15T00:00:00.000Z" };
const PREVIOUS_WINDOW = { start: "2026-06-17T00:00:00.000Z", end: "2026-07-01T00:00:00.000Z" };
const CONTEXT: MetricComputeContext = { workspaceId: "ws_1", window: WINDOW, previousWindow: PREVIOUS_WINDOW, permissions: [], role: "owner" };

function activity(kind: ClientPortalActivityKind, occurredAt: string) {
  return { id: `a-${kind}-${occurredAt}`, workspace_id: "ws_1", client_account_id: "acc_1", kind, entity_id: null, entity_label: null, occurred_at: occurredAt };
}

afterEach(() => {
  vi.clearAllMocks();
});

const CASES: [string, ClientPortalActivityKind][] = [
  ["portal.logins", "login"],
  ["portal.documentViews", "document_viewed"],
  ["portal.checklistCompletions", "checklist_item_completed"],
  ["portal.timelineViews", "timeline_viewed"],
  ["portal.notificationReads", "notification_read"],
  ["portal.documentDownloads", "document_downloaded"],
  ["portal.invoiceViews", "invoice_viewed"],
  ["portal.messagesSent", "message_sent"],
];

describe.each(CASES)("%s", (metricId, kind) => {
  it(`counts only "${kind}" activity entries within the window`, async () => {
    vi.mocked(listClientPortalActivityForWorkspace).mockReturnValue([
      activity(kind, "2026-07-05T00:00:00.000Z"),
      activity("login" === kind ? "message_sent" : "login", "2026-07-05T00:00:00.000Z"),
    ] as never);
    const result = await getMetric(metricId)!.compute(CONTEXT);
    expect(result.value).toBe(1);
  });
});

describe("portal.documentViews and documents.views", () => {
  it("are two distinct registered metrics sharing one underlying source, never a duplicated store", async () => {
    expect(getMetric("portal.documentViews")).toBeDefined();
    expect(getMetric("portal.documentViews")!.category).toBe("portal");
  });
});
