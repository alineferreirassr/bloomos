import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { getWorkspaceSession, getServerRepositoryContext } from "@/lib/auth/workspaceSession";
import { createClient } from "@/lib/supabase/server";

type QueryResult = { data: unknown; error: unknown };

function makeQueryBuilder(result: QueryResult) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    limit: () => builder,
    maybeSingle: async () => result,
    then: (resolve: (value: QueryResult) => void) => resolve(result),
  };
  return builder;
}

function mockSupabaseClient(input: {
  user?: unknown;
  profile?: QueryResult;
  members?: QueryResult;
  workspace?: QueryResult;
  rolePermissions?: QueryResult;
}) {
  const tables: Record<string, ReturnType<typeof makeQueryBuilder>> = {
    profiles: makeQueryBuilder(input.profile ?? { data: null, error: null }),
    workspace_members: makeQueryBuilder(input.members ?? { data: [], error: null }),
    workspaces: makeQueryBuilder(input.workspace ?? { data: null, error: null }),
    role_permissions: makeQueryBuilder(input.rolePermissions ?? { data: [], error: null }),
  };

  return {
    auth: {
      getUser: async () => ({ data: { user: input.user ?? null }, error: null }),
    },
    from: (table: string) => tables[table],
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getWorkspaceSession", () => {
  it("returns unauthenticated when there is no signed-in user", async () => {
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient({ user: null }) as never);

    await expect(getWorkspaceSession()).resolves.toEqual({ status: "unauthenticated" });
  });

  it("returns no-workspace when the profile row does not exist", async () => {
    vi.mocked(createClient).mockResolvedValue(
      mockSupabaseClient({
        user: { id: "user_1", email: "owner@example.com" },
        profile: { data: null, error: null },
      }) as never,
    );

    await expect(getWorkspaceSession()).resolves.toEqual({ status: "no-workspace" });
  });

  it("prefers an active membership over an inactive one when the caller has both", async () => {
    const inactiveRow = {
      id: "member_old",
      workspace_id: "workspace_old",
      user_id: "user_1",
      role: "staff",
      status: "suspended",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    const activeRow = {
      id: "member_1",
      workspace_id: "workspace_1",
      user_id: "user_1",
      role: "owner",
      status: "active",
      created_at: "2026-07-16T00:00:00Z",
      updated_at: "2026-07-16T00:00:00Z",
    };
    const workspaceRow = {
      id: "workspace_1",
      name: "Amoré Bloom",
      slug: "amore-bloom",
      created_by: "user_1",
      created_at: "2026-07-16T00:00:00Z",
      updated_at: "2026-07-16T00:00:00Z",
      archived_at: null,
    };

    vi.mocked(createClient).mockResolvedValue(
      mockSupabaseClient({
        user: { id: "user_1", email: "owner@example.com" },
        profile: {
          data: {
            id: "user_1",
            full_name: null,
            email: "owner@example.com",
            avatar_url: null,
            created_at: "2026-07-16T00:00:00Z",
            updated_at: "2026-07-16T00:00:00Z",
          },
          error: null,
        },
        members: { data: [inactiveRow, activeRow], error: null },
        workspace: { data: workspaceRow, error: null },
      }) as never,
    );

    const result = await getWorkspaceSession();

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok result");
    expect(result.session.membership.id).toBe("member_1");
  });

  it("returns no-workspace when there is no active membership", async () => {
    vi.mocked(createClient).mockResolvedValue(
      mockSupabaseClient({
        user: { id: "user_1", email: "owner@example.com" },
        profile: {
          data: {
            id: "user_1",
            full_name: null,
            email: "owner@example.com",
            avatar_url: null,
            created_at: "2026-07-16T00:00:00Z",
            updated_at: "2026-07-16T00:00:00Z",
          },
          error: null,
        },
        members: { data: [], error: null },
      }) as never,
    );

    await expect(getWorkspaceSession()).resolves.toEqual({ status: "no-workspace" });
  });

  it("resolves the full session for an authenticated owner with an active membership", async () => {
    const user = { id: "user_1", email: "owner@example.com" };
    const profileRow = {
      id: "user_1",
      full_name: null,
      email: "owner@example.com",
      avatar_url: null,
      created_at: "2026-07-16T00:00:00Z",
      updated_at: "2026-07-16T00:00:00Z",
    };
    const memberRow = {
      id: "member_1",
      workspace_id: "workspace_1",
      user_id: "user_1",
      role: "owner",
      status: "active",
      created_at: "2026-07-16T00:00:00Z",
      updated_at: "2026-07-16T00:00:00Z",
    };
    const workspaceRow = {
      id: "workspace_1",
      name: "Amoré Bloom",
      slug: "amore-bloom",
      created_by: "user_1",
      created_at: "2026-07-16T00:00:00Z",
      updated_at: "2026-07-16T00:00:00Z",
      archived_at: null,
    };

    vi.mocked(createClient).mockResolvedValue(
      mockSupabaseClient({
        user,
        profile: { data: profileRow, error: null },
        members: { data: [memberRow], error: null },
        workspace: { data: workspaceRow, error: null },
        rolePermissions: { data: [{ permission_id: "workspace.view" }, { permission_id: "team.view" }], error: null },
      }) as never,
    );

    const result = await getWorkspaceSession();

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok result");
    expect(result.session.user).toBe(user);
    expect(result.session.workspace).toEqual(workspaceRow);
    expect(result.session.membership).toEqual(memberRow);
    expect(result.session.permissions).toEqual(["workspace.view", "team.view"]);
  });

  it("resolves to ok with the real 'suspended' status (and no permissions) when the caller's only membership is inactive — distinct from having no membership at all", async () => {
    const suspendedMemberRow = {
      id: "member_4",
      workspace_id: "workspace_1",
      user_id: "user_1",
      role: "staff",
      status: "suspended",
      created_at: "2026-04-01T00:00:00Z",
      updated_at: "2026-06-01T00:00:00Z",
    };
    const workspaceRow = {
      id: "workspace_1",
      name: "Amoré Bloom",
      slug: "amore-bloom",
      created_by: "user_1",
      created_at: "2026-07-16T00:00:00Z",
      updated_at: "2026-07-16T00:00:00Z",
      archived_at: null,
    };

    vi.mocked(createClient).mockResolvedValue(
      mockSupabaseClient({
        user: { id: "user_1", email: "owner@example.com" },
        profile: {
          data: {
            id: "user_1",
            full_name: null,
            email: "owner@example.com",
            avatar_url: null,
            created_at: "2026-07-16T00:00:00Z",
            updated_at: "2026-07-16T00:00:00Z",
          },
          error: null,
        },
        members: { data: [suspendedMemberRow], error: null },
        workspace: { data: workspaceRow, error: null },
      }) as never,
    );

    const result = await getWorkspaceSession();

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok result");
    expect(result.session.membership.status).toBe("suspended");
    expect(result.session.permissions).toEqual([]);
  });

  it("returns no-workspace when the membership's Workspace does not resolve", async () => {
    vi.mocked(createClient).mockResolvedValue(
      mockSupabaseClient({
        user: { id: "user_1", email: "owner@example.com" },
        profile: {
          data: {
            id: "user_1",
            full_name: null,
            email: "owner@example.com",
            avatar_url: null,
            created_at: "2026-07-16T00:00:00Z",
            updated_at: "2026-07-16T00:00:00Z",
          },
          error: null,
        },
        members: {
          data: [
            {
              id: "member_1",
              workspace_id: "workspace_missing",
              user_id: "user_1",
              role: "owner",
              status: "active",
              created_at: "2026-07-16T00:00:00Z",
              updated_at: "2026-07-16T00:00:00Z",
            },
          ],
          error: null,
        },
        workspace: { data: null, error: null },
      }) as never,
    );

    await expect(getWorkspaceSession()).resolves.toEqual({ status: "no-workspace" });
  });

  it("throws a normalized error when the profile query fails", async () => {
    vi.mocked(createClient).mockResolvedValue(
      mockSupabaseClient({
        user: { id: "user_1", email: "owner@example.com" },
        profile: { data: null, error: { code: "42501", message: "permission denied" } },
      }) as never,
    );

    await expect(getWorkspaceSession()).rejects.toThrow("You don't have permission to do that.");
  });

  it("throws a normalized error when the membership query fails", async () => {
    vi.mocked(createClient).mockResolvedValue(
      mockSupabaseClient({
        user: { id: "user_1", email: "owner@example.com" },
        profile: {
          data: {
            id: "user_1",
            full_name: null,
            email: "owner@example.com",
            avatar_url: null,
            created_at: "2026-07-16T00:00:00Z",
            updated_at: "2026-07-16T00:00:00Z",
          },
          error: null,
        },
        members: { data: null, error: { message: "fetch failed" } },
      }) as never,
    );

    await expect(getWorkspaceSession()).rejects.toThrow(
      "Could not reach the server. Check your connection and try again.",
    );
  });
});

describe("getServerRepositoryContext", () => {
  it("returns the server Supabase client paired with the resolved session when authenticated with an active Workspace", async () => {
    const user = { id: "user_1", email: "owner@example.com" };
    const profileRow = {
      id: "user_1",
      full_name: null,
      email: "owner@example.com",
      avatar_url: null,
      created_at: "2026-07-16T00:00:00Z",
      updated_at: "2026-07-16T00:00:00Z",
    };
    const memberRow = {
      id: "member_1",
      workspace_id: "workspace_1",
      user_id: "user_1",
      role: "owner",
      status: "active",
      created_at: "2026-07-16T00:00:00Z",
      updated_at: "2026-07-16T00:00:00Z",
    };
    const workspaceRow = {
      id: "workspace_1",
      name: "Amoré Bloom",
      slug: "amore-bloom",
      created_by: "user_1",
      created_at: "2026-07-16T00:00:00Z",
      updated_at: "2026-07-16T00:00:00Z",
      archived_at: null,
    };
    const supabaseClient = mockSupabaseClient({
      user,
      profile: { data: profileRow, error: null },
      members: { data: [memberRow], error: null },
      workspace: { data: workspaceRow, error: null },
      rolePermissions: { data: [{ permission_id: "workspace.view" }], error: null },
    });
    vi.mocked(createClient).mockResolvedValue(supabaseClient as never);

    const context = await getServerRepositoryContext();

    expect(context.supabase).toBe(supabaseClient);
    expect(context.session.workspace.id).toBe("workspace_1");
    expect(context.session.membership.id).toBe("member_1");
  });

  it("throws UnauthorizedError when there is no signed-in user (never silently returns an empty context)", async () => {
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient({ user: null }) as never);

    await expect(getServerRepositoryContext()).rejects.toThrow("Authentication is required.");
  });

  it("throws ForbiddenError when the signed-in user has no Workspace membership", async () => {
    vi.mocked(createClient).mockResolvedValue(
      mockSupabaseClient({
        user: { id: "user_1", email: "owner@example.com" },
        profile: { data: null, error: null },
      }) as never,
    );

    await expect(getServerRepositoryContext()).rejects.toThrow("You don't have permission to do that.");
  });
});
