import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));
// getServerRepositoryContext() is only ever called in Supabase data mode (see
// getOwnerDashboardData.ts) — these tests run in mock mode, but the module
// still imports @/lib/auth/workspaceSession, which transitively imports the
// server-only-gated @/lib/supabase/server. Mock it out so that import doesn't
// throw in this non-Server-Component test environment.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { getOwnerDashboardData } from "@/modules/dashboard/luxury/getOwnerDashboardData";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

function session(overrides: Partial<MemberSessionSnapshot & { kind: "active" }> = {}): MemberSessionSnapshot {
  return {
    kind: "active",
    user: { id: "user_1", email: "owner@amorebloom.com" },
    profile: { full_name: "Aline Ferreira", avatar_url: null },
    workspace: { id: CURRENT_WORKSPACE_ID, name: "Amoré Bloom" },
    membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
    permissions: [],
    workspaceDisplayName: "Amoré Bloom",
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getOwnerDashboardData", () => {
  it("rejects an unauthenticated session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await getOwnerDashboardData();
    expect(result.success).toBe(false);
  });

  it("rejects a staff member (team experience, not owner)", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session({ membership: { id: "member_1", role: "staff", status: "active", created_at: "2026-01-01T00:00:00Z" } }));
    const result = await getOwnerDashboardData();
    expect(result.success).toBe(false);
  });

  it("returns a real, plain, serializable DTO for an owner", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session());
    const result = await getOwnerDashboardData();
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.welcome.greeting).toContain("Aline");
    expect(result.data.metrics).toHaveLength(5);
    expect(result.data.weekAgenda).toHaveLength(7);
    expect(result.data.revenueSeries).toHaveLength(6);

    // Every value must be JSON-serializable (no functions, class instances, or symbols) —
    // the exact class of bug the Analytics checkpoint hit returning a live function reference.
    expect(() => JSON.parse(JSON.stringify(result.data))).not.toThrow();
    for (const metric of result.data.metrics) {
      expect(typeof metric.icon).toBe("string");
    }
  });

  it("admins also resolve to the owner experience", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session({ membership: { id: "member_1", role: "admin", status: "active", created_at: "2026-01-01T00:00:00Z" } }));
    const result = await getOwnerDashboardData();
    expect(result.success).toBe(true);
  });
});
