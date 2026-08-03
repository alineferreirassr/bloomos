import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn().mockResolvedValue({ kind: "unauthenticated" }),
}));

import { resetAllMockData } from "@/lib/data";
import { getClientPortalJourneySummaryAction } from "@/modules/clientPortal/getClientPortalJourneySummary";
import { JOURNEY_STAGE_DEFAULT_LABELS } from "@/types/clientJourney";

afterEach(() => {
  vi.clearAllMocks();
});

beforeEach(() => {
  resetAllMockData();
});

describe("getClientPortalJourneySummaryAction", () => {
  it("returns a client-safe summary with a known stage label and numeric progress", async () => {
    const result = await getClientPortalJourneySummaryAction();
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(Object.values(JOURNEY_STAGE_DEFAULT_LABELS)).toContain(result.data.currentStageLabel);
    expect(result.data.progressPercentage).toBeGreaterThanOrEqual(0);
    expect(result.data.progressPercentage).toBeLessThanOrEqual(100);
    expect(Array.isArray(result.data.completedMilestoneLabels)).toBe(true);
    expect(Array.isArray(result.data.pendingInformationRequests)).toBe(true);
  });

  it("never exposes internal-only journey fields (blockers/risks/owners/context)", async () => {
    const result = await getClientPortalJourneySummaryAction();
    expect(result.success).toBe(true);
    if (!result.success) return;

    const serialized = JSON.stringify(result.data);
    expect(serialized).not.toContain("\"blockers\"");
    expect(serialized).not.toContain("\"risks\"");
    expect(serialized).not.toContain("\"owners\"");
  });
});
