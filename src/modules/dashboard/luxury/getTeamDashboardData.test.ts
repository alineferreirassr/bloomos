import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
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
});
