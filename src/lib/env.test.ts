import { afterEach, describe, expect, it } from "vitest";
import { assertSupabaseConfigured, getDataMode, getPublicEnv, isSupabaseConfigured, SupabaseConfigurationError } from "@/lib/env";

const ENV_KEYS = ["NEXT_PUBLIC_DATA_MODE", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

afterEach(() => {
  clearEnv();
});

describe("getDataMode", () => {
  it("defaults to mock when NEXT_PUBLIC_DATA_MODE is unset", () => {
    clearEnv();
    expect(getDataMode()).toBe("mock");
  });

  it("defaults to mock for any unrecognized value", () => {
    process.env.NEXT_PUBLIC_DATA_MODE = "production";
    expect(getDataMode()).toBe("mock");
  });

  it("returns supabase only for the exact string 'supabase'", () => {
    process.env.NEXT_PUBLIC_DATA_MODE = "supabase";
    expect(getDataMode()).toBe("supabase");
  });

  it("trims surrounding whitespace", () => {
    process.env.NEXT_PUBLIC_DATA_MODE = "  supabase  ";
    expect(getDataMode()).toBe("supabase");
  });
});

describe("getPublicEnv", () => {
  it("treats empty-string env values as undefined", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "   ";
    expect(getPublicEnv().supabaseUrl).toBeUndefined();
    expect(getPublicEnv().supabaseAnonKey).toBeUndefined();
  });

  it("re-reads process.env on every call rather than caching", () => {
    clearEnv();
    expect(getPublicEnv().dataMode).toBe("mock");
    process.env.NEXT_PUBLIC_DATA_MODE = "supabase";
    expect(getPublicEnv().dataMode).toBe("supabase");
  });
});

describe("isSupabaseConfigured", () => {
  it("is false in mock mode with no credentials", () => {
    clearEnv();
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("is false when only one of url/anon key is present", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("is true when both url and anon key are present", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    expect(isSupabaseConfigured()).toBe(true);
  });
});

describe("assertSupabaseConfigured", () => {
  it("never throws in mock mode, even with no credentials", () => {
    clearEnv();
    expect(() => assertSupabaseConfigured()).not.toThrow();
  });

  it("does not throw in mock mode even if module load happens with supabase env vars set but mode unset", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    expect(() => assertSupabaseConfigured()).not.toThrow();
  });

  it("throws SupabaseConfigurationError when supabase mode is selected without credentials", () => {
    process.env.NEXT_PUBLIC_DATA_MODE = "supabase";
    expect(() => assertSupabaseConfigured()).toThrow(SupabaseConfigurationError);
  });

  it("throws when supabase mode is selected with only a partial credential set", () => {
    process.env.NEXT_PUBLIC_DATA_MODE = "supabase";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    expect(() => assertSupabaseConfigured()).toThrow(SupabaseConfigurationError);
  });

  it("does not throw when supabase mode is selected with both credentials present", () => {
    process.env.NEXT_PUBLIC_DATA_MODE = "supabase";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    expect(() => assertSupabaseConfigured()).not.toThrow();
  });

  it("never exposes a secret-looking hint in the error message", () => {
    process.env.NEXT_PUBLIC_DATA_MODE = "supabase";
    try {
      assertSupabaseConfigured();
      expect.fail("expected assertSupabaseConfigured to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(SupabaseConfigurationError);
      expect((error as Error).message).not.toMatch(/service_role|password|secret|access token/i);
    }
  });
});
