import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn().mockResolvedValue({ kind: "unauthenticated" }),
}));
// This module transitively imports @/modules/clientJourney/clientJourneyActions,
// which now imports @/lib/auth/workspaceSession, which transitively imports the
// server-only-gated @/lib/supabase/server. Mock it out so that import doesn't
// throw in this non-Server-Component test environment.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { resetAllMockData, getClientPortalOverview, getClientPortalContracts } from "@/lib/data";
import { getCoreKnowledgeGraphService } from "@/core/knowledge";
import { getClientPortalKnowledgeSummaryAction } from "@/modules/clientPortal/getClientPortalKnowledgeSummary";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

afterEach(() => {
  vi.clearAllMocks();
});

beforeEach(() => {
  resetAllMockData();
});

describe("getClientPortalKnowledgeSummaryAction", () => {
  it("surfaces a client-safe relationship (event -> contract) as a plain-language connection", async () => {
    const overview = await getClientPortalOverview();
    const eventId = overview.upcomingEvent?.id;
    expect(eventId).toBeTruthy();
    if (!eventId) return;

    const contracts = await getClientPortalContracts();
    const contract = contracts[0];
    expect(contract).toBeTruthy();
    if (!contract) return;

    const created = await getCoreKnowledgeGraphService().createRelationship(CURRENT_WORKSPACE_ID, "test_actor", {
      sourceNodeType: "contract",
      sourceNodeId: contract.id,
      targetNodeType: "event",
      targetNodeId: eventId,
      relationshipType: "associated_with_event",
      source: "user_action",
    });
    expect(created.success).toBe(true);

    const result = await getClientPortalKnowledgeSummaryAction(eventId);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const match = result.data.connections.find((c) => c.nodeType === "contract" && c.nodeId === contract.id);
    expect(match).toBeTruthy();
    expect(match?.label).toBe(contract.title);
    expect(match?.relationshipLabel).toBe("Associated With Event");
    expect(match?.href).toBe(`/client-access/contracts/${contract.id}`);
  });

  it("filters out internal-only node types (never surfaces a comment/message/workflow edge)", async () => {
    const overview = await getClientPortalOverview();
    const eventId = overview.upcomingEvent?.id;
    expect(eventId).toBeTruthy();
    if (!eventId) return;

    await getCoreKnowledgeGraphService().createRelationship(CURRENT_WORKSPACE_ID, "test_actor", {
      sourceNodeType: "event",
      sourceNodeId: eventId,
      targetNodeType: "comment",
      targetNodeId: "cmt_internal_only",
      relationshipType: "commented_on",
      source: "user_action",
    });

    const result = await getClientPortalKnowledgeSummaryAction(eventId);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.connections.some((c) => (c.nodeType as string) === "comment")).toBe(false);
  });

  it("returns a generic error for an event id that doesn't belong to the current client (never leaks another client's data)", async () => {
    const result = await getClientPortalKnowledgeSummaryAction("evt_does_not_exist_or_not_mine");
    expect(result.success).toBe(false);
  });
});
