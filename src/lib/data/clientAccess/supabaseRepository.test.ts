import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/auth/workspaceSessionClient", () => ({
  getClientWorkspaceSession: vi.fn(),
}));

import { supabaseClientAccessRepository } from "@/lib/data/clientAccess/supabaseRepository";
import { createClient } from "@/lib/supabase/client";
import { getClientWorkspaceSession } from "@/lib/auth/workspaceSessionClient";

type QueryResult = { data: unknown; error: unknown };
type RecordedCall = { table: string; method: string; args: unknown[] };

function createMockSupabase(responses: QueryResult[], authUser: { id: string } | null = null) {
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
    b.order = chain("order");
    b.limit = chain("limit");
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
    auth: {
      getUser: async () => ({ data: { user: authUser }, error: authUser ? null : null }),
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

function accountRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "client_account_1",
    workspace_id: "workspace_1",
    client_id: "client_1",
    auth_user_id: "auth_client_1",
    email: "naomi.whitfield@example.com",
    status: "active",
    invited_by: "user_1",
    accepted_at: "2026-06-01T00:00:00Z",
    suspended_at: null,
    revoked_at: null,
    last_access_at: null,
    created_at: "2026-05-28T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

function invitationRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "client_invitation_1",
    workspace_id: "workspace_1",
    client_id: "client_1",
    email: "new.client@example.com",
    invited_by: "user_1",
    token_hash: "abc123",
    status: "pending",
    expires_at: "2026-08-01T00:00:00Z",
    accepted_at: null,
    revoked_at: null,
    created_at: "2026-07-24T00:00:00Z",
    updated_at: "2026-07-24T00:00:00Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("supabaseClientAccessRepository.getClientAccounts", () => {
  it("scopes to the current Workspace, optionally filtered by client", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([{ data: [accountRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const accounts = await supabaseClientAccessRepository.getClientAccounts("client_1");

    expect(accounts).toHaveLength(1);
    const eqWorkspace = calls.find((c) => c.table === "client_accounts" && c.method === "eq" && c.args[0] === "workspace_id");
    expect(eqWorkspace?.args).toEqual(["workspace_id", "workspace_1"]);
    const eqClient = calls.find((c) => c.table === "client_accounts" && c.method === "eq" && c.args[0] === "client_id");
    expect(eqClient?.args).toEqual(["client_id", "client_1"]);
  });

  it("throws Unauthorized when there is no signed-in user", async () => {
    vi.mocked(getClientWorkspaceSession).mockResolvedValue({ status: "unauthenticated" });
    const { client } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseClientAccessRepository.getClientAccounts()).rejects.toThrow("Authentication is required.");
  });

  it("throws Forbidden when the internal caller has no active Workspace membership", async () => {
    vi.mocked(getClientWorkspaceSession).mockResolvedValue({ status: "no-workspace" });
    const { client } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseClientAccessRepository.getClientAccounts()).rejects.toThrow("You don't have permission to do that.");
  });
});

describe("supabaseClientAccessRepository.getCurrentClientAccount", () => {
  it("resolves the caller's own active account via auth.getUser() — no Workspace session involved", async () => {
    const { client } = createMockSupabase([{ data: [accountRow()], error: null }], { id: "auth_client_1" });
    vi.mocked(createClient).mockReturnValue(client as never);

    const account = await supabaseClientAccessRepository.getCurrentClientAccount();
    expect(account?.id).toBe("client_account_1");
    expect(getClientWorkspaceSession).not.toHaveBeenCalled();
  });

  it("returns null when there is no authenticated user", async () => {
    const { client } = createMockSupabase([], null);
    vi.mocked(createClient).mockReturnValue(client as never);

    expect(await supabaseClientAccessRepository.getCurrentClientAccount()).toBeNull();
  });

  it("returns a suspended/revoked account rather than null — distinguishing 'blocked' from 'no account at all'", async () => {
    const { client } = createMockSupabase([{ data: [accountRow({ status: "suspended" })], error: null }], { id: "auth_client_1" });
    vi.mocked(createClient).mockReturnValue(client as never);

    const account = await supabaseClientAccessRepository.getCurrentClientAccount();
    expect(account?.status).toBe("suspended");
  });

  it("getCurrentClientAccountContext combines the resolved account with the get_current_client_account_context RPC's display names", async () => {
    const { client } = createMockSupabase(
      [
        { data: [accountRow()], error: null },
        {
          data: [{ account_id: "client_account_1", workspace_name: "Amoré Bloom", client_name: "Naomi Whitfield", status: "active", last_access_at: null }],
          error: null,
        },
      ],
      { id: "auth_client_1" },
    );
    vi.mocked(createClient).mockReturnValue(client as never);

    const context = await supabaseClientAccessRepository.getCurrentClientAccountContext();
    expect(context?.account.id).toBe("client_account_1");
    expect(context?.clientName).toBe("Naomi Whitfield");
    expect(context?.workspaceName).toBe("Amoré Bloom");
  });

  it("prefers an active account over an inactive one when the caller holds several", async () => {
    const { client } = createMockSupabase(
      [{ data: [accountRow({ id: "acct_suspended", status: "suspended" }), accountRow({ id: "acct_active", status: "active" })], error: null }],
      { id: "auth_client_1" },
    );
    vi.mocked(createClient).mockReturnValue(client as never);

    const account = await supabaseClientAccessRepository.getCurrentClientAccount();
    expect(account?.id).toBe("acct_active");
  });
});

describe("supabaseClientAccessRepository suspend/reactivate/revoke", () => {
  it("suspend sets status=suspended", async () => {
    const { client, calls } = createMockSupabase([{ data: accountRow({ status: "suspended" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseClientAccessRepository.suspendClientAccount("client_account_1");
    expect(result.success).toBe(true);
    const updateCall = calls.find((c) => c.table === "client_accounts" && c.method === "update");
    expect((updateCall?.args[0] as Record<string, unknown>).status).toBe("suspended");
  });

  it("translates an action-authority trigger error (P0111) into a DataResult failure", async () => {
    const { client } = createMockSupabase([]);
    client.from = () => {
      const b: Record<string, unknown> = {};
      b.update = () => b;
      b.eq = () => b;
      b.select = () => b;
      b.single = async () => ({ data: null, error: { code: "P0111", message: "You do not have permission to revoke or reactivate this Client Portal account." } });
      return b;
    };
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseClientAccessRepository.revokeClientAccount("client_account_1");
    expect(result.success).toBe(false);
  });
});

describe("supabaseClientAccessRepository.updateClientLastAccess / canCurrentUserAccessClient", () => {
  it("delegates to the touch_client_account_last_access RPC", async () => {
    const { client, rpcCalls } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseClientAccessRepository.updateClientLastAccess("client_account_1");
    expect(rpcCalls[0].name).toBe("touch_client_account_last_access");
  });

  it("delegates to the is_client_account_holder RPC", async () => {
    const { client, rpcCalls } = createMockSupabase([{ data: true, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseClientAccessRepository.canCurrentUserAccessClient("client_1");
    expect(result).toBe(true);
    expect(rpcCalls[0]).toEqual({ name: "is_client_account_holder", args: { p_client_id: "client_1" } });
  });
});

describe("supabaseClientAccessRepository.createClientInvitation", () => {
  it("returns a validation failure without touching Supabase for an invalid email", async () => {
    const { client } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseClientAccessRepository.createClientInvitation({ client_id: "client_1", email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("inserts scoped to the Workspace with a hashed token, returns the raw token once", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([{ data: invitationRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseClientAccessRepository.createClientInvitation({ client_id: "client_1", email: "New.Client@Example.com" });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.token.length).toBeGreaterThan(0);
    const insertCall = calls.find((c) => c.table === "client_invitations" && c.method === "insert");
    const payload = insertCall?.args[0] as Record<string, unknown>;
    expect(payload.workspace_id).toBe("workspace_1");
    expect(payload.client_id).toBe("client_1");
    expect(payload.email).toBe("new.client@example.com");
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

    const result = await supabaseClientAccessRepository.createClientInvitation({ client_id: "client_1", email: "dupe@example.com" });
    expect(result.success).toBe(false);
  });
});

describe("supabaseClientAccessRepository resend/revoke invitation", () => {
  it("resend fails for a non-pending invitation", async () => {
    const { client } = createMockSupabase([{ data: invitationRow({ status: "accepted" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseClientAccessRepository.resendClientInvitation("client_invitation_1");
    expect(result.success).toBe(false);
  });

  it("revoke sets status=revoked for a pending invitation", async () => {
    const { client, calls } = createMockSupabase([
      { data: invitationRow(), error: null },
      { data: invitationRow({ status: "revoked" }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseClientAccessRepository.revokeClientInvitation("client_invitation_1");
    expect(result.success).toBe(true);
    const updateCall = calls.find((c) => c.table === "client_invitations" && c.method === "update");
    expect((updateCall?.args[0] as Record<string, unknown>).status).toBe("revoked");
  });
});

describe("supabaseClientAccessRepository.acceptClientInvitation", () => {
  it("delegates to the accept_client_invitation RPC — no Workspace session required", async () => {
    const { client, rpcCalls } = createMockSupabase([{ data: accountRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseClientAccessRepository.acceptClientInvitation("some-raw-token");

    expect(result.success).toBe(true);
    expect(rpcCalls[0]).toEqual({ name: "accept_client_invitation", args: { p_token: "some-raw-token" } });
    expect(getClientWorkspaceSession).not.toHaveBeenCalled();
  });

  it("translates a rejection errcode (e.g. P0106 email mismatch) into a DataResult failure", async () => {
    const { client } = createMockSupabase([]);
    client.rpc = async () => ({ data: null, error: { code: "P0106", message: "This invitation was sent to a different email address." } });
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseClientAccessRepository.acceptClientInvitation("some-token");
    expect(result.success).toBe(false);
  });
});

describe("supabaseClientAccessRepository.getClientInvitationByToken", () => {
  it("delegates to the get_client_invitation_by_token RPC and returns null when not found", async () => {
    const { client, rpcCalls } = createMockSupabase([{ data: [], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const preview = await supabaseClientAccessRepository.getClientInvitationByToken("nope");
    expect(preview).toBeNull();
    expect(rpcCalls[0].name).toBe("get_client_invitation_by_token");
  });

  it("returns the preview row when found — no session required", async () => {
    const { client } = createMockSupabase([
      {
        data: [{ workspace_name: "Amoré Bloom", client_name: "Naomi Whitfield", email: "x@example.com", status: "pending", expires_at: "2026-08-01T00:00:00Z" }],
        error: null,
      },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const preview = await supabaseClientAccessRepository.getClientInvitationByToken("some-token");
    expect(preview?.client_name).toBe("Naomi Whitfield");
    expect(getClientWorkspaceSession).not.toHaveBeenCalled();
  });
});
