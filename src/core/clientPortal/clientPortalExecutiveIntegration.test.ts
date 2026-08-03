import { describe, expect, it } from "vitest";
import { clientPortalRevisionRequestToRecommendations } from "@/core/clientPortal/clientPortalExecutiveIntegration";

describe("clientPortalRevisionRequestToRecommendations", () => {
  it("returns a warning under the stale threshold", () => {
    const recs = clientPortalRevisionRequestToRecommendations({
      proposalId: "prop_1",
      clientName: "Naomi Whitfield",
      revisionRequestedAt: "2026-07-29T00:00:00.000Z",
      now: "2026-07-30T00:00:00.000Z",
    });
    expect(recs).toHaveLength(1);
    expect(recs[0].severity).toBe("warning");
    expect(recs[0].ruleId).toBe("client_portal.revision_request_waiting");
    expect(recs[0].node).toEqual({ nodeType: "proposal", nodeId: "prop_1" });
    expect(recs[0].message).toContain("Naomi Whitfield");
    expect(recs[0].message).toContain("1 day(s) ago");
  });

  it("escalates to critical at and beyond the stale threshold", () => {
    const recs = clientPortalRevisionRequestToRecommendations({
      proposalId: "prop_2",
      clientName: "James Whitfield",
      revisionRequestedAt: "2026-07-20T00:00:00.000Z",
      now: "2026-07-30T00:00:00.000Z",
    });
    expect(recs[0].severity).toBe("critical");
    expect(recs[0].message).toContain("10 day(s) ago");
  });

  it("never returns a negative day count for a future revisionRequestedAt (clock skew safety)", () => {
    const recs = clientPortalRevisionRequestToRecommendations({
      proposalId: "prop_3",
      clientName: "A Client",
      revisionRequestedAt: "2026-08-01T00:00:00.000Z",
      now: "2026-07-30T00:00:00.000Z",
    });
    expect(recs[0].message).toContain("0 day(s) ago");
  });
});
