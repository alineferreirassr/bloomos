import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn().mockResolvedValue({ kind: "unauthenticated" }),
}));

import { resetAllMockData } from "@/lib/data";
import { getClientPortalJourneyDetailAction, respondToClientPortalJourneyNoteAction } from "@/modules/clientPortal/getClientPortalJourneyDetail";
import { JOURNEY_STAGES } from "@/types/clientJourney";

afterEach(() => {
  vi.clearAllMocks();
});

beforeEach(() => {
  resetAllMockData();
});

describe("getClientPortalJourneyDetailAction", () => {
  it("returns every journey stage as a step, with exactly one marked current", async () => {
    const result = await getClientPortalJourneyDetailAction();
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.steps).toHaveLength(JOURNEY_STAGES.length);
    const currentSteps = result.data.steps.filter((s) => s.status === "current");
    expect(currentSteps).toHaveLength(1);
  });

  it("never exposes internal-only journey fields (blockers/risks/owners/context)", async () => {
    const result = await getClientPortalJourneyDetailAction();
    expect(result.success).toBe(true);
    if (!result.success) return;

    const serialized = JSON.stringify(result.data);
    expect(serialized).not.toContain("\"blockers\"");
    expect(serialized).not.toContain("\"risks\"");
    expect(serialized).not.toContain("\"owners\"");
  });
});

describe("respondToClientPortalJourneyNoteAction", () => {
  it("rejects an empty response", async () => {
    const result = await respondToClientPortalJourneyNoteAction("req_1", "   ");
    expect(result.success).toBe(false);
  });

  it("rejects a request id that doesn't belong to the current client", async () => {
    const result = await respondToClientPortalJourneyNoteAction("req_does_not_exist", "Here's my answer.");
    expect(result.success).toBe(false);
  });
});
