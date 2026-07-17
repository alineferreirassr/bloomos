import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/auth/workspaceSessionClient", () => ({
  getClientWorkspaceSession: vi.fn(),
}));

import { supabaseTeamRepository } from "@/lib/data/team/supabaseRepository";
import { createClient } from "@/lib/supabase/client";
import { getClientWorkspaceSession } from "@/lib/auth/workspaceSessionClient";

type QueryResult = { data: unknown; error: unknown };
type RecordedCall = { table: string; method: string; args: unknown[] };

function createMockSupabase(responses: QueryResult[]) {
  const calls: RecordedCall[] = [];
  const rpcCalls: { name: string; args: unknown }[] = [];
  let i = 0;
  function nextResult(): QueryResult {
    if (i >= responses.length) throw new Error(`No mock Supabase response queued for call #${i + 1}`);
    return responses[i++];
  }
  function builder(table: string) {
    const b: Record<string, unknown> = {};
    const chain =
      (method: string) =>
      (...args: unknown[]) => {
        calls.push({ table, method, args });
        return b;
      };
    b.select = chain("select");
    b.eq = chain("eq");
    b.lt = chain("lt");
    b.in = chain("in");
    b.order = chain("order");
    b.insert = chain("insert");
    b.update = chain("update");
    b.delete = chain("delete");
    b.maybeSingle = async () => {
      calls.push({ table, method: "maybeSingle", args: [] });
      return nextResult();
    };
    b.single = async () => {
      calls.push({ table, method: "single", args: [] });
      return nextResult();
    };
    b.then = (resolve: (value: QueryResult) => void) => {
      calls.push({ table, method: "then", args: [] });
      resolve(nextResult());
    };
    return b;
  }
  const client = {
    from: (table: string) => builder(table),
    rpc: async (name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      return nextResult();
    },
  };
  return { client, calls, rpcCalls };
}

const SESSION = {
  status: "ok" as const,
  session: {
    user: { id: "user_1", email: "owner@example.com" },
    profile: {
      id: "user_1",
      full_name: "Amoré Bloom Owner",
      email: "owner@example.com",
      avatar_url: null,
      created_at: "2026-07-18T00:00:00Z",
      updated_at: "2026-07-18T00:00:00Z",
    },
    workspace: {
      id: "workspace_1",
      name: "Amoré Bloom",
      slug: "amore-bloom",
      created_by: "user_1",
      created_at: "2026-07-18T00:00:00Z",
      updated_at: "2026-07-18T00:00:00Z",
      archived_at: null,
    },
    membership: {
      id: "member_1",
      workspace_id: "workspace_1",
      user_id: "user_1",
      role: "owner" as const,
      status: "active" as const,
      created_at: "2026-07-18T00:00:00Z",
      updated_at: "2026-07-18T00:00:00Z",
    },
  },
};

function mockSession() {
  vi.mocked(getClientWorkspaceSession).mockResolvedValue(SESSION as never);
}

function memberRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "member_1",
    workspace_id: "workspace_1",
    user_id: "user_1",
    role: "owner",
    status: "active",
    created_at: "2026-07-24T00:00:00Z",
    updated_at: "2026-07-24T00:00:00Z",
    ...overrides,
  };
}

function profileRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "user_1",
    full_name: "Amoré Bloom Owner",
    email: "owner@example.com",
    avatar_url: null,
    ...overrides,
  };
}

function invitationRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "invitation_1",
    workspace_id: "workspace_1",
    email: "new.hire@example.com",
    invited_role: "staff",
    invited_by: "user_1",
    token_hash: "abc123",
    status: "pending",
    expires_at: "2026-08-01T00:00:00Z",
    accepted_at: null,
    accepted_by: null,
    revoked_at: null,
    created_at: "2026-07-24T00:00:00Z",
    updated_at: "2026-07-24T00:00:00Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("supabaseTeamRepository.getWorkspaceMembers", () => {
  it("scopes to the current Workspace and joins profiles", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: [memberRow()], error: null },
      { data: [profileRow()], error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const members = await supabaseTeamRepository.getWorkspaceMembers();

    expect(members).toHaveLength(1);
    expect(members[0].email).toBe("owner@example.com");
    const eqWorkspace = calls.find((c) => c.table === "workspace_members" && c.method === "eq");
    expect(eqWorkspace?.args).toEqual(["workspace_id", "workspace_1"]);
  });
});

describe("supabaseTeamRepository.getCurrentWorkspaceMember", () => {
  it("resolves directly from the session, no extra query", async () => {
    mockSession();
    const member = await supabaseTeamRepository.getCurrentWorkspaceMember();
    expect(member?.role).toBe("owner");
    expect(member?.email).toBe("owner@example.com");
  });

  it("returns null when unauthenticated", async () => {
    vi.mocked(getClientWorkspaceSession).mockResolvedValue({ status: "unauthenticated" });
    const member = await supabaseTeamRepository.getCurrentWorkspaceMember();
    expect(member).toBeNull();
  });
});

describe("supabaseTeamRepository.updateWorkspaceMemberRole", () => {
  it("updates the role and returns the joined member", async () => {
    const { client } = createMockSupabase([
      { data: memberRow({ role: "admin" }), error: null },
      { data: [profileRow()], error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseTeamRepository.updateWorkspaceMemberRole("member_1", "admin");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.role).toBe("admin");
  });

  it("translates a last-owner-protection trigger error (P0013) into a DataResult failure", async () => {
    const { client } = createMockSupabase([]);
    client.from = () => {
      const b: Record<string, unknown> = {};
      b.update = () => b;
      b.eq = () => b;
      b.select = () => b;
      b.single = async () => ({ data: null, error: { code: "P0013", message: "The last active owner cannot be demoted." } });
      return b;
    };
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseTeamRepository.updateWorkspaceMemberRole("member_1", "admin");
    expect(result.success).toBe(false);
  });
});

describe("supabaseTeamRepository deactivate/reactivate/remove", () => {
  it("deactivate sets status=suspended", async () => {
    const { client, calls } = createMockSupabase([
      { data: memberRow({ status: "suspended" }), error: null },
      { data: [profileRow()], error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseTeamRepository.deactivateWorkspaceMember("member_1");
    expect(result.success).toBe(true);
    const updateCall = calls.find((c) => c.table === "workspace_members" && c.method === "update");
    expect((updateCall?.args[0] as Record<string, unknown>).status).toBe("suspended");
  });

  it("remove issues a delete, never an update", async () => {
    const { client, calls } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseTeamRepository.removeWorkspaceMember("member_1");
    expect(result.success).toBe(true);
    expect(calls.some((c) => c.table === "workspace_members" && c.method === "delete")).toBe(true);
  });

  it("remove translates a last-owner-protection error", async () => {
    const { client } = createMockSupabase([]);
    client.from = () => {
      const b: Record<string, unknown> = {};
      b.delete = () => b;
      b.eq = async () => ({ data: null, error: { code: "P0013", message: "The last active owner cannot be removed." } });
      return b;
    };
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseTeamRepository.removeWorkspaceMember("member_1");
    expect(result.success).toBe(false);
  });
});

describe("supabaseTeamRepository permissions", () => {
  it("getRolePermissions queries role_permissions by role_id", async () => {
    const { client, calls } = createMockSupabase([
      { data: [{ permission_id: "leads.view" }, { permission_id: "team.view" }], error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const permissions = await supabaseTeamRepository.getRolePermissions("staff");
    expect(permissions).toEqual(["leads.view", "team.view"]);
    const eqCall = calls.find((c) => c.table === "role_permissions" && c.method === "eq");
    expect(eqCall?.args).toEqual(["role_id", "staff"]);
  });

  it("canWorkspaceMember checks the resolved role's permission set", async () => {
    const { client } = createMockSupabase([
      { data: memberRow({ role: "owner" }), error: null },
      { data: [{ permission_id: "team.invite" }], error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseTeamRepository.canWorkspaceMember("member_1", "team.invite");
    expect(result).toBe(true);
  });
});

describe("supabaseTeamRepository.createWorkspaceInvitation", () => {
  it("returns a validation failure without touching Supabase for an invalid email", async () => {
    const { client } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseTeamRepository.createWorkspaceInvitation({ email: "not-an-email", invited_role: "staff" });
    expect(result.success).toBe(false);
  });

  it("inserts scoped to the Workspace with a hashed token, returns the raw token once", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([{ data: invitationRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseTeamRepository.createWorkspaceInvitation({ email: "New.Hire@Example.com", invited_role: "staff" });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.token.length).toBeGreaterThan(0);
    const insertCall = calls.find((c) => c.table === "workspace_invitations" && c.method === "insert");
    const payload = insertCall?.args[0] as Record<string, unknown>;
    expect(payload.workspace_id).toBe("workspace_1");
    expect(payload.email).toBe("new.hire@example.com");
    expect(payload.token_hash).not.toBe(result.data.token);
  });

  it("translates the pending-per-email unique violation (23505) into a DataResult failure", async () => {
    mockSession();
    const { client } = createMockSupabase([]);
    client.from = () => {
      const b: Record<string, unknown> = {};
      b.insert = () => b;
      b.select = () => b;
      b.single = async () => ({ data: null, error: { code: "23505", message: "duplicate key" } });
      return b;
    };
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseTeamRepository.createWorkspaceInvitation({ email: "dupe@example.com", invited_role: "staff" });
    expect(result.success).toBe(false);
  });

  it("translates the invitation-role-authority trigger error (P0014)", async () => {
    mockSession();
    const { client } = createMockSupabase([]);
    client.from = () => {
      const b: Record<string, unknown> = {};
      b.insert = () => b;
      b.select = () => b;
      b.single = async () => ({ data: null, error: { code: "P0014", message: "You are not authorized to invite someone as owner." } });
      return b;
    };
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseTeamRepository.createWorkspaceInvitation({ email: "x@example.com", invited_role: "owner" });
    expect(result.success).toBe(false);
  });
});

describe("supabaseTeamRepository resend/revoke", () => {
  it("resend fails for a non-pending invitation", async () => {
    const { client } = createMockSupabase([{ data: invitationRow({ status: "accepted" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseTeamRepository.resendWorkspaceInvitation("invitation_1");
    expect(result.success).toBe(false);
  });

  it("resend updates token_hash/expires_at for a pending invitation", async () => {
    const { client, calls } = createMockSupabase([
      { data: invitationRow(), error: null },
      { data: invitationRow(), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseTeamRepository.resendWorkspaceInvitation("invitation_1");
    expect(result.success).toBe(true);
    const updateCall = calls.find((c) => c.table === "workspace_invitations" && c.method === "update");
    expect(updateCall?.args[0]).toHaveProperty("token_hash");
    expect(updateCall?.args[0]).toHaveProperty("expires_at");
  });

  it("revoke fails for a non-pending invitation", async () => {
    const { client } = createMockSupabase([{ data: invitationRow({ status: "revoked" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseTeamRepository.revokeWorkspaceInvitation("invitation_1");
    expect(result.success).toBe(false);
  });

  it("revoke sets status=revoked for a pending invitation", async () => {
    const { client, calls } = createMockSupabase([
      { data: invitationRow(), error: null },
      { data: invitationRow({ status: "revoked" }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseTeamRepository.revokeWorkspaceInvitation("invitation_1");
    expect(result.success).toBe(true);
    const updateCall = calls.find((c) => c.table === "workspace_invitations" && c.method === "update");
    expect((updateCall?.args[0] as Record<string, unknown>).status).toBe("revoked");
  });
});

describe("supabaseTeamRepository.acceptWorkspaceInvitation", () => {
  it("delegates to the accept_workspace_invitation RPC", async () => {
    const { client, rpcCalls } = createMockSupabase([
      { data: memberRow({ role: "staff", user_id: "user_2" }), error: null },
      { data: [profileRow({ id: "user_2", email: "new@example.com" })], error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseTeamRepository.acceptWorkspaceInvitation("some-raw-token");

    expect(result.success).toBe(true);
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].name).toBe("accept_workspace_invitation");
    expect(rpcCalls[0].args).toEqual({ p_token: "some-raw-token" });
  });

  it("translates a rejection errcode (e.g. P0006 email mismatch) into a DataResult failure", async () => {
    const { client } = createMockSupabase([]);
    client.rpc = async () => ({ data: null, error: { code: "P0006", message: "This invitation was sent to a different email address." } });
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseTeamRepository.acceptWorkspaceInvitation("some-token");
    expect(result.success).toBe(false);
  });
});

describe("supabaseTeamRepository.getInvitationByToken", () => {
  it("delegates to the get_invitation_by_token RPC and returns null when not found", async () => {
    const { client, rpcCalls } = createMockSupabase([{ data: [], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const preview = await supabaseTeamRepository.getInvitationByToken("nope");
    expect(preview).toBeNull();
    expect(rpcCalls[0].name).toBe("get_invitation_by_token");
  });

  it("returns the preview row when found — no session required", async () => {
    const { client } = createMockSupabase([
      {
        data: [{ workspace_name: "Amoré Bloom", email: "x@example.com", invited_role: "staff", status: "pending", expires_at: "2026-08-01T00:00:00Z" }],
        error: null,
      },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const preview = await supabaseTeamRepository.getInvitationByToken("some-token");
    expect(preview?.email).toBe("x@example.com");
    expect(getClientWorkspaceSession).not.toHaveBeenCalled();
  });
});

describe("supabaseTeamRepository Workspace isolation / session errors", () => {
  it("getWorkspaceMembers throws Unauthorized when there is no signed-in user", async () => {
    vi.mocked(getClientWorkspaceSession).mockResolvedValue({ status: "unauthenticated" });
    const { client } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseTeamRepository.getWorkspaceMembers()).rejects.toThrow("Authentication is required.");
  });

  it("getWorkspaceInvitations throws Forbidden when the user has no active Workspace membership", async () => {
    vi.mocked(getClientWorkspaceSession).mockResolvedValue({ status: "no-workspace" });
    const { client } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseTeamRepository.getWorkspaceInvitations()).rejects.toThrow("You don't have permission to do that.");
  });
});
