import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));
// getServerRepositoryContext() is only ever called in Supabase data mode (see
// getTeamDashboardData.ts) — these tests run in mock mode, but the module
// still imports @/lib/auth/workspaceSession, which transitively imports the
// server-only-gated @/lib/supabase/server. Mock it out so that import doesn't
// throw in this non-Server-Component test environment.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
// See the identical mock in getOwnerDashboardData.test.ts — Calendar's own
// module already covers the real fetch; here only the aggregator's own
// plumbing matters, and the real fan-out is too slow for this test's timeout.
vi.mock("@/modules/calendar/calendarActions", () => ({
  getCalendarEventsAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));
// See the identical mock in getOwnerDashboardData.test.ts — getEventWeather()
// hits a real network fetch when the member's current event happens to carry
// coordinates; eventWeatherEngine.test.ts already covers that engine directly.
vi.mock("@/core/weather/eventWeatherEngine", () => ({
  getEventWeather: vi.fn().mockResolvedValue({ success: false, error: { reason: "MISSING_COORDINATES", message: "" } }),
}));

import { getTeamDashboardData } from "@/modules/dashboard/luxury/getTeamDashboardData";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resetTeamRoleLabelStore, setTeamRoleLabel } from "@/lib/data/core/dashboard/teamRoleLabelStore";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

function session(overrides: Partial<MemberSessionSnapshot & { kind: "active" }> = {}): MemberSessionSnapshot {
  return {
    kind: "active",
    user: { id: "user_2", email: "staff@amorebloom.com" },
    profile: { full_name: "Sophia Martins", avatar_url: null },
    workspace: { id: CURRENT_WORKSPACE_ID, name: "Amoré Bloom" },
    membership: { id: "member_2", role: "staff", status: "active", created_at: "2026-01-01T00:00:00Z" },
    permissions: ["events.view"],
    workspaceDisplayName: "Amoré Bloom",
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  resetTeamRoleLabelStore();
});

describe("getTeamDashboardData", () => {
  it("rejects an unauthenticated session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await getTeamDashboardData();
    expect(result.success).toBe(false);
  });

  it("rejects an owner (owner experience, not team)", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session({ membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" } }));
    const result = await getTeamDashboardData();
    expect(result.success).toBe(false);
  });

  it("returns a real, plain, serializable DTO for a staff member, reflecting their own teamRoleLabel", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session());
    setTeamRoleLabel("member_2", "photographer");

    const result = await getTeamDashboardData();
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.welcome.greeting).toContain("Sophia");
    expect(result.data.teamRoleLabel).toBe("photographer");
    expect(result.data.metrics).toHaveLength(4);
    expect(result.data.progressStages).toHaveLength(6);

    expect(() => JSON.parse(JSON.stringify(result.data))).not.toThrow();
  });

  it("never returns workspace-wide events to a staff member without events.view", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session({ permissions: [] }));
    const result = await getTeamDashboardData();
    expect(result.success).toBe(true);
    if (!result.success) return;
    // With no permission and (in this seed data) no events assigned by name to "Sophia Martins",
    // the effective event set must be empty — never a silent fallback to every workspace event.
    expect(result.data.schedule.length).toBe(0);
  });

  // Today's Work presentational remediation — "Current Event" must never
  // present a future event as if it were happening today.
  it("marks currentEventIsToday true when the visible event is actually scheduled today", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-22T12:00:00.000Z")); // event_1's own event_date
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session());

    const result = await getTeamDashboardData();
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.currentEvent?.title).toBe("Malibu Sunset Proposal");
    expect(result.data.currentEventIsToday).toBe(true);
  });

  it("marks currentEventIsToday false when nothing is scheduled today, even though a next-upcoming event is still shown", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-18T12:00:00.000Z")); // no seed event falls on this date
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session());

    const result = await getTeamDashboardData();
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.schedule.length).toBe(0);
    expect(result.data.currentEvent).not.toBeNull();
    expect(result.data.currentEventIsToday).toBe(false);
  });
});
