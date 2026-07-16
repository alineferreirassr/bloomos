import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

import { getClientWorkspaceSession } from "@/lib/auth/workspaceSessionClient";
import { createClient } from "@/lib/supabase/client";

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
  userError?: unknown;
  profile?: QueryResult;
  members?: QueryResult;
  workspace?: QueryResult;
}) {
  const tables: Record<string, ReturnType<typeof makeQueryBuilder>> = {
    profiles: makeQueryBuilder(input.profile ?? { data: null, error: null }),
    workspace_members: makeQueryBuilder(input.members ?? { data: [], error: null }),
    workspaces: makeQueryBuilder(input.workspace ?? { data: null, error: null }),
  };

  return {
    auth: {
      getUser: async () => ({ data: { user: input.user ?? null }, error: input.userError ?? null }),
    },
    from: (table: string) => tables[table],
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getClientWorkspaceSession", () => {
  it("returns unauthenticated when there is no signed-in user", () => {
    vi.mocked(createClient).mockReturnValue(mockSupabaseClient({ user: null }) as never);

    return expect(getClientWorkspaceSession()).resolves.toEqual({ status: "unauthenticated" });
  });

  it("returns unauthenticated when getUser reports a missing session, rather than throwing", () => {
    vi.mocked(createClient).mockReturnValue(
      mockSupabaseClient({ user: null, userError: { name: "AuthSessionMissingError", status: 401 } }) as never,
    );

    return expect(getClientWorkspaceSession()).resolves.toEqual({ status: "unauthenticated" });
  });

  it("returns no-workspace when the profile row does not exist", () => {
    vi.mocked(createClient).mockReturnValue(
      mockSupabaseClient({
        user: { id: "user_1", email: "owner@example.com" },
        profile: { data: null, error: null },
      }) as never,
    );

    return expect(getClientWorkspaceSession()).resolves.toEqual({ status: "no-workspace" });
  });

  it("returns no-workspace when there is no active membership", () => {
    vi.mocked(createClient).mockReturnValue(
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

    return expect(getClientWorkspaceSession()).resolves.toEqual({ status: "no-workspace" });
  });

  it("resolves the full session for an authenticated owner with an active membership", async () => {
    const user = { id: "user_1", email: "owner@example.com" };
    const profileRow = {
      id: "user_1",
      full_name: "Amoré Bloom Owner",
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

    vi.mocked(createClient).mockReturnValue(
      mockSupabaseClient({
        user,
        profile: { data: profileRow, error: null },
        members: { data: [memberRow], error: null },
        workspace: { data: workspaceRow, error: null },
      }) as never,
    );

    const result = await getClientWorkspaceSession();

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok result");
    expect(result.session.user).toBe(user);
    expect(result.session.workspace).toEqual(workspaceRow);
    expect(result.session.membership).toEqual(memberRow);
  });

  it("throws a normalized error when the profile query fails", () => {
    vi.mocked(createClient).mockReturnValue(
      mockSupabaseClient({
        user: { id: "user_1", email: "owner@example.com" },
        profile: { data: null, error: { code: "42501", message: "permission denied" } },
      }) as never,
    );

    return expect(getClientWorkspaceSession()).rejects.toThrow("You don't have permission to do that.");
  });
});
