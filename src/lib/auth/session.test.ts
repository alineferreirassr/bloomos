import { describe, expect, it, vi } from "vitest";
import { getCurrentUser, getSession } from "@/lib/auth/session";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";

function mockSupabaseClient(overrides: {
  getSession?: () => Promise<{ data: { session: unknown }; error: unknown }>;
  getUser?: () => Promise<{ data: { user: unknown }; error: unknown }>;
}) {
  return {
    auth: {
      getSession: overrides.getSession ?? (async () => ({ data: { session: null }, error: null })),
      getUser: overrides.getUser ?? (async () => ({ data: { user: null }, error: null })),
    },
  };
}

describe("getSession", () => {
  it("returns the session when Supabase resolves one", async () => {
    const session = { access_token: "token", user: { id: "user_1" } };
    vi.mocked(createClient).mockResolvedValue(
      mockSupabaseClient({ getSession: async () => ({ data: { session }, error: null }) }) as never,
    );

    await expect(getSession()).resolves.toBe(session);
  });

  it("returns null when signed out", async () => {
    vi.mocked(createClient).mockResolvedValue(
      mockSupabaseClient({ getSession: async () => ({ data: { session: null }, error: null }) }) as never,
    );

    await expect(getSession()).resolves.toBeNull();
  });

  it("throws a normalized error when Supabase returns an error", async () => {
    vi.mocked(createClient).mockResolvedValue(
      mockSupabaseClient({
        getSession: async () => ({ data: { session: null }, error: { status: 500, message: "server error" } }),
      }) as never,
    );

    await expect(getSession()).rejects.toThrow();
  });
});

describe("getCurrentUser", () => {
  it("returns the user when authenticated", async () => {
    const user = { id: "user_1", email: "jordan@example.com" };
    vi.mocked(createClient).mockResolvedValue(
      mockSupabaseClient({ getUser: async () => ({ data: { user }, error: null }) }) as never,
    );

    await expect(getCurrentUser()).resolves.toBe(user);
  });

  it("returns null (not a throw) when there is no session", async () => {
    vi.mocked(createClient).mockResolvedValue(
      mockSupabaseClient({
        getUser: async () => ({ data: { user: null }, error: { name: "AuthSessionMissingError", message: "Auth session missing" } }),
      }) as never,
    );

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("throws a normalized error for a real Supabase failure", async () => {
    vi.mocked(createClient).mockResolvedValue(
      mockSupabaseClient({
        getUser: async () => ({ data: { user: null }, error: { status: 500, name: "AuthApiError", message: "server error" } }),
      }) as never,
    );

    await expect(getCurrentUser()).rejects.toThrow();
  });
});
