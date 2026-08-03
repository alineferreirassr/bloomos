import { describe, expect, it, vi } from "vitest";

/**
 * `listClientPortalProposalsAction` (Step 1's own Portal Home composition)
 * shares `proposalPlatformActions.ts` with internal-team-only actions that
 * import `resolveMemberSessionSnapshot` at module scope — which reaches the
 * real Supabase server client (`server-only`-guarded) regardless of data
 * mode. That's harmless in the real app (Next's bundler splits client vs.
 * server graphs), but a plain Vitest/jsdom import evaluates the whole
 * module graph directly, so it throws. Mocked out here the same way
 * `getOwnerDashboardData.test.ts` already does for the identical reason —
 * this dashboard's own DTO never reads a member/workspace session anyway.
 */
vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn().mockResolvedValue({ kind: "unauthenticated" }),
}));

import { getClientDashboardData } from "@/modules/clientAccess/getClientDashboardData";

/**
 * Mock mode seeds a real "current client account" (`MOCK_CURRENT_CLIENT_ACCOUNT_ID`)
 * the same way it seeds a real "current member" — no session mocking needed,
 * the same pattern `getClientPortalOverview()` and friends already rely on.
 */
describe("getClientDashboardData", () => {
  it("returns a real, plain, serializable DTO for the current client account", async () => {
    const result = await getClientDashboardData();
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.welcome.greeting).toMatch(/^Welcome, /);
    expect(typeof result.data.paymentTotalLabel).toBe("string");
    expect(Array.isArray(result.data.checklist)).toBe(true);
    expect(Array.isArray(result.data.includedServices)).toBe(true);
    expect(Array.isArray(result.data.recentActivity)).toBe(true);
    expect(result.data.planner.name.length).toBeGreaterThan(0);

    // Every value must be JSON-serializable — never a rendered element or function
    // returned from this "use server" action (the Analytics checkpoint's own bug class).
    expect(() => JSON.parse(JSON.stringify(result.data))).not.toThrow();
  });

  it("never exposes a phone number that isn't a real field on the resolved planner", async () => {
    const result = await getClientDashboardData();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.planner.phone).toBeNull();
  });
});
