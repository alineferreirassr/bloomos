import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Map([["host", "app.bloomos.test"]])),
}));

import { requestPasswordReset, signInWithPassword, signOut, updatePassword } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function mockSupabaseClient(overrides: {
  signInWithPassword?: () => Promise<{ error: unknown }>;
  signOut?: () => Promise<{ error: unknown }>;
  resetPasswordForEmail?: () => Promise<{ error: unknown }>;
  updateUser?: () => Promise<{ error: unknown }>;
}) {
  return {
    auth: {
      signInWithPassword: overrides.signInWithPassword ?? (async () => ({ error: null })),
      signOut: overrides.signOut ?? (async () => ({ error: null })),
      resetPasswordForEmail: overrides.resetPasswordForEmail ?? (async () => ({ error: null })),
      updateUser: overrides.updateUser ?? (async () => ({ error: null })),
    },
  };
}

function setSupabaseConfigured() {
  process.env.NEXT_PUBLIC_DATA_MODE = "supabase";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
}

function clearSupabaseConfig() {
  delete process.env.NEXT_PUBLIC_DATA_MODE;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

afterEach(() => {
  clearSupabaseConfig();
  vi.clearAllMocks();
});

describe("signInWithPassword", () => {
  it("returns a clear error when Supabase is not configured (mock mode)", async () => {
    clearSupabaseConfig();
    const result = await signInWithPassword({ email: "a@b.com", password: "secret" });
    expect(result).toEqual({ success: false, error: expect.stringContaining("not configured") });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects to /dashboard by default on success", async () => {
    setSupabaseConfigured();
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient({}) as never);

    await signInWithPassword({ email: "a@b.com", password: "secret" });

    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("preserves an explicit same-origin redirectTo destination", async () => {
    setSupabaseConfigured();
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient({}) as never);

    await signInWithPassword({ email: "a@b.com", password: "secret", redirectTo: "/documents" });

    expect(redirect).toHaveBeenCalledWith("/documents");
  });

  it("ignores an external redirectTo and falls back to /dashboard", async () => {
    setSupabaseConfigured();
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient({}) as never);

    await signInWithPassword({ email: "a@b.com", password: "secret", redirectTo: "https://evil.example.com" });

    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("ignores a protocol-relative redirectTo and falls back to /dashboard", async () => {
    setSupabaseConfigured();
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient({}) as never);

    await signInWithPassword({ email: "a@b.com", password: "secret", redirectTo: "//evil.example.com" });

    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("returns a normalized error message and does not redirect on invalid credentials", async () => {
    setSupabaseConfigured();
    vi.mocked(createClient).mockResolvedValue(
      mockSupabaseClient({
        signInWithPassword: async () => ({ error: { name: "AuthApiError", status: 400, message: "Invalid login credentials" } }),
      }) as never,
    );

    const result = await signInWithPassword({ email: "a@b.com", password: "wrong" });

    expect(result).toEqual({ success: false, error: "Incorrect email or password." });
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("signOut", () => {
  it("succeeds as a no-op when Supabase is not configured", async () => {
    clearSupabaseConfig();
    const result = await signOut();
    expect(result).toEqual({ success: true });
  });

  it("redirects to /sign-in on success", async () => {
    setSupabaseConfigured();
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient({}) as never);

    await signOut();

    expect(redirect).toHaveBeenCalledWith("/sign-in");
  });
});

describe("requestPasswordReset", () => {
  it("returns a clear error when Supabase is not configured", async () => {
    clearSupabaseConfig();
    const result = await requestPasswordReset({ email: "a@b.com" });
    expect(result.success).toBe(false);
  });

  it("returns success without redirecting when the reset email is sent", async () => {
    setSupabaseConfigured();
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient({}) as never);

    const result = await requestPasswordReset({ email: "a@b.com" });

    expect(result).toEqual({ success: true });
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("updatePassword", () => {
  it("returns a clear error when Supabase is not configured", async () => {
    clearSupabaseConfig();
    const result = await updatePassword({ password: "new-secret" });
    expect(result.success).toBe(false);
  });

  it("redirects to /sign-in on success", async () => {
    setSupabaseConfigured();
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient({}) as never);

    await updatePassword({ password: "new-secret" });

    expect(redirect).toHaveBeenCalledWith("/sign-in");
  });
});
