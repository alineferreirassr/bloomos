import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { SupabasePendingOAuthVaultProvider } from "@/core/integrations/pendingAuthorizationVaultProvider";

function mockSupabaseRpc(response: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(response);
  vi.mocked(createClient).mockResolvedValue({ rpc } as never);
  return rpc;
}

let provider: SupabasePendingOAuthVaultProvider;

beforeEach(() => {
  provider = new SupabasePendingOAuthVaultProvider();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("SupabasePendingOAuthVaultProvider", () => {
  it("encrypt() calls store_integration_secret with the plaintext code_verifier and returns the vault secret id", async () => {
    const rpc = mockSupabaseRpc({ data: "secret_id_abc", error: null });

    const ref = await provider.encrypt("real-pkce-code-verifier");

    expect(rpc).toHaveBeenCalledWith("store_integration_secret", { p_plaintext: "real-pkce-code-verifier", p_name: "oauth_pending_code_verifier" });
    expect(ref).toBe("secret_id_abc");
  });

  it("encrypt() throws rather than silently returning a fabricated ref when Vault returns no id", async () => {
    mockSupabaseRpc({ data: null, error: null });

    await expect(provider.encrypt("verifier")).rejects.toThrow(/did not return a secret id/i);
  });

  it("decrypt() calls read_pending_oauth_secret (never read_integration_secret) with the ref", async () => {
    const rpc = mockSupabaseRpc({ data: "real-pkce-code-verifier", error: null });

    const plaintext = await provider.decrypt("secret_id_abc");

    expect(rpc).toHaveBeenCalledWith("read_pending_oauth_secret", { p_secret_id: "secret_id_abc" });
    expect(plaintext).toBe("real-pkce-code-verifier");
  });

  it("decrypt() returns null (fail closed) rather than throwing when the function reports no ownership match", async () => {
    mockSupabaseRpc({ data: null, error: null });

    const plaintext = await provider.decrypt("someone_elses_secret_id");

    expect(plaintext).toBeNull();
  });

  it("propagates a real Supabase/Postgres error from either call rather than swallowing it", async () => {
    mockSupabaseRpc({ data: null, error: { message: "connection refused", code: "08006" } });

    await expect(provider.encrypt("verifier")).rejects.toThrow();
  });
});
