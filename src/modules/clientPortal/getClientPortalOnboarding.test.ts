import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn().mockResolvedValue({ kind: "unauthenticated" }),
}));

import { resetAllMockData } from "@/lib/data";
import { getClientPortalOnboardingAction } from "@/modules/clientPortal/getClientPortalOnboarding";
import { JOURNEY_STAGE_DEFAULT_LABELS } from "@/types/clientJourney";

afterEach(() => {
  vi.clearAllMocks();
});

beforeEach(() => {
  resetAllMockData();
});

describe("getClientPortalOnboardingAction", () => {
  it("returns a client-safe onboarding projection with a known stage label and numeric progress", async () => {
    const result = await getClientPortalOnboardingAction();
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(Object.values(JOURNEY_STAGE_DEFAULT_LABELS)).toContain(result.data.currentStageLabel);
    expect(result.data.progressPercentage).toBeGreaterThanOrEqual(0);
    expect(result.data.progressPercentage).toBeLessThanOrEqual(100);
    expect(result.data.currentStageProgress).toBeGreaterThanOrEqual(0);
    expect(result.data.currentStageProgress).toBeLessThanOrEqual(100);
    expect(typeof result.data.inOnboarding).toBe("boolean");
    expect(Array.isArray(result.data.checklist)).toBe(true);
  });

  it("projects checklist items directly from the current stage's own requirements", async () => {
    const result = await getClientPortalOnboardingAction();
    expect(result.success).toBe(true);
    if (!result.success) return;

    for (const item of result.data.checklist) {
      expect(typeof item.id).toBe("string");
      expect(typeof item.title).toBe("string");
      expect(typeof item.completed).toBe("boolean");
    }
  });

  it("never exposes internal-only journey fields (blockers/risks/owners/context)", async () => {
    const result = await getClientPortalOnboardingAction();
    expect(result.success).toBe(true);
    if (!result.success) return;

    const serialized = JSON.stringify(result.data);
    expect(serialized).not.toContain("\"blockers\"");
    expect(serialized).not.toContain("\"risks\"");
    expect(serialized).not.toContain("\"owners\"");
  });
});
