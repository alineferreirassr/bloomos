import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));
// getServerRepositoryContext() is only ever called in Supabase data mode (see
// teamRoleLabelActions.ts) — these tests run in mock mode, but the module
// still imports @/lib/auth/workspaceSession, which transitively imports the
// server-only-gated @/lib/supabase/server. Mock it out so that import doesn't
// throw in this non-Server-Component test environment.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { getOwnTeamRoleLabelAction, listTeamRoleLabelsAction, setTeamRoleLabelAction } from "@/modules/dashboard/teamRoleLabelActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resetTeamRoleLabelStore } from "@/lib/data/core/dashboard/teamRoleLabelStore";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

const MEMBER_ID = "member_1";

const activeSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: CURRENT_WORKSPACE_ID, name: "Amoré Bloom" },
  membership: { id: MEMBER_ID, role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["team.view", "team.manage_roles"],
  workspaceDisplayName: "Amoré Bloom",
};

afterEach(() => {
  vi.clearAllMocks();
  resetTeamRoleLabelStore();
});

describe("setTeamRoleLabelAction", () => {
  it("requires team.manage_roles", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, permissions: [] });
    const result = await setTeamRoleLabelAction(MEMBER_ID, "photographer");
    expect(result.success).toBe(false);
  });

  it("rejects a member from a different workspace", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, workspace: { id: "ws_other", name: "Other" } });
    const result = await setTeamRoleLabelAction(MEMBER_ID, "photographer");
    expect(result.success).toBe(false);
  });

  it("rejects an unknown member id", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await setTeamRoleLabelAction("nonexistent-member", "photographer");
    expect(result.success).toBe(false);
  });

  it("sets the label for a real member in the session's own workspace", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await setTeamRoleLabelAction(MEMBER_ID, "photographer");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("photographer");
  });
});

describe("getOwnTeamRoleLabelAction / listTeamRoleLabelsAction", () => {
  it("getOwnTeamRoleLabelAction reflects a label set via setTeamRoleLabelAction", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    await setTeamRoleLabelAction(MEMBER_ID, "designer");
    const result = await getOwnTeamRoleLabelAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("designer");
  });

  it("listTeamRoleLabelsAction requires team.view", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, permissions: [] });
    const result = await listTeamRoleLabelsAction();
    expect(result.success).toBe(false);
  });

  it("listTeamRoleLabelsAction returns every workspace member's own label", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    await setTeamRoleLabelAction(MEMBER_ID, "coordinator");
    const result = await listTeamRoleLabelsAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data[MEMBER_ID]).toBe("coordinator");
  });
});
