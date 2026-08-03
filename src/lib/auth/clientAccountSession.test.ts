import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  getDataMode: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/data", () => ({
  getCurrentClientAccountContext: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { resolveClientAccountSessionSnapshot } from "@/lib/auth/clientAccountSession";
import { getDataMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";
import { getCurrentClientAccountContext } from "@/lib/data";

const ACTIVE_CONTEXT = {
  account: {
    id: "account_1",
    workspace_id: "ws_1",
    client_id: "client_1",
    auth_user_id: "auth_1",
    email: "naomi@example.com",
    status: "active" as const,
    invited_by: "auth_owner",
    accepted_at: "2026-06-01T00:00:00.000Z",
    suspended_at: null,
    revoked_at: null,
    last_access_at: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
  },
  clientName: "Naomi Whitfield",
  workspaceName: "Amoré Bloom",
};

describe("resolveClientAccountSessionSnapshot", () => {
  it("resolves unauthenticated in supabase mode with no signed-in user, never calling the repository", async () => {
    vi.mocked(getDataMode).mockReturnValue("supabase");
    vi.mocked(createClient).mockReturnValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } } as never);

    const snapshot = await resolveClientAccountSessionSnapshot();

    expect(snapshot).toEqual({ kind: "unauthenticated" });
    expect(getCurrentClientAccountContext).not.toHaveBeenCalled();
  });

  it("skips the auth check entirely in mock mode", async () => {
    vi.mocked(getDataMode).mockReturnValue("mock");
    vi.mocked(getCurrentClientAccountContext).mockResolvedValue(ACTIVE_CONTEXT as never);

    const snapshot = await resolveClientAccountSessionSnapshot();

    expect(snapshot.kind).toBe("active");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("resolves no-account when the repository returns null", async () => {
    vi.mocked(getDataMode).mockReturnValue("mock");
    vi.mocked(getCurrentClientAccountContext).mockResolvedValue(null);

    const snapshot = await resolveClientAccountSessionSnapshot();

    expect(snapshot).toEqual({ kind: "no-account" });
  });

  it("resolves blocked with the account's status for a suspended/revoked account", async () => {
    vi.mocked(getDataMode).mockReturnValue("mock");
    vi.mocked(getCurrentClientAccountContext).mockResolvedValue({
      ...ACTIVE_CONTEXT,
      account: { ...ACTIVE_CONTEXT.account, status: "suspended" },
    } as never);

    const snapshot = await resolveClientAccountSessionSnapshot();

    expect(snapshot).toEqual({ kind: "blocked", status: "suspended" });
  });

  it("resolves active with every raw id and display field the Client Portal pages need", async () => {
    vi.mocked(getDataMode).mockReturnValue("mock");
    vi.mocked(getCurrentClientAccountContext).mockResolvedValue(ACTIVE_CONTEXT as never);

    const snapshot = await resolveClientAccountSessionSnapshot();

    expect(snapshot).toEqual({
      kind: "active",
      authUserId: "auth_1",
      accountId: "account_1",
      clientId: "client_1",
      workspaceId: "ws_1",
      email: "naomi@example.com",
      clientName: "Naomi Whitfield",
      workspaceName: "Amoré Bloom",
      acceptedAt: "2026-06-01T00:00:00.000Z",
      lastAccessAt: null,
    });
  });

  it("resolves a distinct error state when the repository throws, never an unhandled rejection", async () => {
    vi.mocked(getDataMode).mockReturnValue("mock");
    vi.mocked(getCurrentClientAccountContext).mockRejectedValue(new Error("network failure"));

    const snapshot = await resolveClientAccountSessionSnapshot();

    expect(snapshot).toEqual({ kind: "error" });
  });
});
