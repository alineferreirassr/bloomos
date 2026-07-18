import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data", () => ({
  getCurrentWorkspaceMember: vi.fn(),
  getWorkspaceMemberPermissions: vi.fn(),
}));

vi.mock("@/lib/auth/workspaceSession", () => ({
  getWorkspaceSession: vi.fn(),
}));

import { resolveMemberSessionSnapshot, toMemberAccessState } from "@/lib/auth/memberSessionSnapshot";
import { getCurrentWorkspaceMember, getWorkspaceMemberPermissions } from "@/lib/data";
import { getWorkspaceSession } from "@/lib/auth/workspaceSession";

function clearDataMode() {
  delete process.env.NEXT_PUBLIC_DATA_MODE;
}

function setSupabaseMode() {
  process.env.NEXT_PUBLIC_DATA_MODE = "supabase";
}

afterEach(() => {
  clearDataMode();
  vi.clearAllMocks();
});

describe("resolveMemberSessionSnapshot (mock mode)", () => {
  it("resolves to no-workspace when there is no current member", async () => {
    clearDataMode();
    vi.mocked(getCurrentWorkspaceMember).mockResolvedValue(null);

    await expect(resolveMemberSessionSnapshot()).resolves.toEqual({ kind: "no-workspace" });
  });

  it("resolves to active with permissions for an active current member", async () => {
    clearDataMode();
    vi.mocked(getCurrentWorkspaceMember).mockResolvedValue({
      id: "member_1",
      workspace_id: "ws_amore_bloom",
      user_id: "user_1",
      role: "owner",
      status: "active",
      full_name: "Amoré Bloom Owner",
      email: "owner@amorebloom.com",
      avatar_url: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    vi.mocked(getWorkspaceMemberPermissions).mockResolvedValue(["workspace.view", "team.view"]);

    const result = await resolveMemberSessionSnapshot();

    expect(result.kind).toBe("active");
    if (result.kind !== "active") throw new Error("expected active");
    expect(result.membership.role).toBe("owner");
    expect(result.permissions).toEqual(["workspace.view", "team.view"]);
    expect(result.workspaceDisplayName).toBe("Amoré Bloom");
  });

  it("resolves to inactive with no permissions for a suspended current member", async () => {
    clearDataMode();
    vi.mocked(getCurrentWorkspaceMember).mockResolvedValue({
      id: "member_4",
      workspace_id: "ws_amore_bloom",
      user_id: "user_4",
      role: "staff",
      status: "suspended",
      full_name: "Sofia Lima",
      email: "sofia@amorebloom.com",
      avatar_url: null,
      created_at: "2026-04-01T00:00:00.000Z",
      updated_at: "2026-06-01T00:00:00.000Z",
    });

    const result = await resolveMemberSessionSnapshot();

    expect(result.kind).toBe("inactive");
    expect(getWorkspaceMemberPermissions).not.toHaveBeenCalled();
    if (result.kind !== "inactive") throw new Error("expected inactive");
    expect(result.membership.status).toBe("suspended");
    expect(result.workspaceDisplayName).toBe("Amoré Bloom Team");
  });
});

describe("resolveMemberSessionSnapshot (supabase mode)", () => {
  it("passes through unauthenticated", async () => {
    setSupabaseMode();
    vi.mocked(getWorkspaceSession).mockResolvedValue({ status: "unauthenticated" });

    await expect(resolveMemberSessionSnapshot()).resolves.toEqual({ kind: "unauthenticated" });
  });

  it("passes through no-workspace", async () => {
    setSupabaseMode();
    vi.mocked(getWorkspaceSession).mockResolvedValue({ status: "no-workspace" });

    await expect(resolveMemberSessionSnapshot()).resolves.toEqual({ kind: "no-workspace" });
  });

  it("resolves to active for an active Supabase session, with owner-only branding", async () => {
    setSupabaseMode();
    vi.mocked(getWorkspaceSession).mockResolvedValue({
      status: "ok",
      session: {
        user: { id: "user_1", email: "owner@example.com" } as never,
        profile: {
          id: "user_1",
          full_name: "Real Owner",
          email: "owner@example.com",
          avatar_url: null,
          created_at: "2026-07-16T00:00:00Z",
          updated_at: "2026-07-16T00:00:00Z",
        },
        workspace: {
          id: "workspace_1",
          name: "Amoré Bloom",
          slug: "amore-bloom",
          created_by: "user_1",
          created_at: "2026-07-16T00:00:00Z",
          updated_at: "2026-07-16T00:00:00Z",
          archived_at: null,
        },
        membership: {
          id: "member_1",
          workspace_id: "workspace_1",
          user_id: "user_1",
          role: "owner",
          status: "active",
          created_at: "2026-07-16T00:00:00Z",
          updated_at: "2026-07-16T00:00:00Z",
        },
        permissions: ["workspace.view", "workspace.manage"],
      },
    });

    const result = await resolveMemberSessionSnapshot();

    expect(result.kind).toBe("active");
    if (result.kind !== "active") throw new Error("expected active");
    expect(result.permissions).toEqual(["workspace.view", "workspace.manage"]);
    expect(result.workspaceDisplayName).toBe("Amoré Bloom");
  });

  it("resolves to inactive with 'Amoré Bloom Team' branding for a suspended Supabase member", async () => {
    setSupabaseMode();
    vi.mocked(getWorkspaceSession).mockResolvedValue({
      status: "ok",
      session: {
        user: { id: "user_4", email: "sofia@example.com" } as never,
        profile: {
          id: "user_4",
          full_name: "Sofia Lima",
          email: "sofia@example.com",
          avatar_url: null,
          created_at: "2026-07-16T00:00:00Z",
          updated_at: "2026-07-16T00:00:00Z",
        },
        workspace: {
          id: "workspace_1",
          name: "Amoré Bloom",
          slug: "amore-bloom",
          created_by: "user_1",
          created_at: "2026-07-16T00:00:00Z",
          updated_at: "2026-07-16T00:00:00Z",
          archived_at: null,
        },
        membership: {
          id: "member_4",
          workspace_id: "workspace_1",
          user_id: "user_4",
          role: "staff",
          status: "suspended",
          created_at: "2026-07-16T00:00:00Z",
          updated_at: "2026-07-16T00:00:00Z",
        },
        permissions: [],
      },
    });

    const result = await resolveMemberSessionSnapshot();

    expect(result.kind).toBe("inactive");
    if (result.kind !== "inactive") throw new Error("expected inactive");
    expect(result.workspaceDisplayName).toBe("Amoré Bloom Team");
  });
});

describe("toMemberAccessState", () => {
  it("maps active with its permissions", () => {
    expect(
      toMemberAccessState({
        kind: "active",
        user: { id: "u", email: "e" },
        profile: { full_name: null, avatar_url: null },
        workspace: { id: "w", name: "Amoré Bloom" },
        membership: { id: "m", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
        permissions: ["team.view"],
        workspaceDisplayName: "Amoré Bloom",
      }),
    ).toEqual({ kind: "active", permissions: ["team.view"] });
  });

  it("maps unauthenticated/no-workspace/inactive without a permissions field", () => {
    expect(toMemberAccessState({ kind: "unauthenticated" })).toEqual({ kind: "unauthenticated" });
    expect(toMemberAccessState({ kind: "no-workspace" })).toEqual({ kind: "no-workspace" });
    expect(
      toMemberAccessState({
        kind: "inactive",
        user: { id: "u", email: "e" },
        profile: { full_name: null, avatar_url: null },
        workspace: { id: "w", name: "Amoré Bloom" },
        membership: { id: "m", role: "staff", status: "suspended", created_at: "2026-01-01T00:00:00Z" },
        workspaceDisplayName: "Amoré Bloom Team",
      }),
    ).toEqual({ kind: "inactive" });
  });
});
