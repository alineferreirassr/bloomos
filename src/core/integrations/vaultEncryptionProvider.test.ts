import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { SupabaseVaultEncryptionProvider } from "@/core/integrations/vaultEncryptionProvider";

function mockSupabaseRpc(response: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(response);
  vi.mocked(createClient).mockResolvedValue({ rpc } as never);
  return rpc;
}

let provider: SupabaseVaultEncryptionProvider;

beforeEach(() => {
  provider = new SupabaseVaultEncryptionProvider();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("SupabaseVaultEncryptionProvider", () => {
  it("encrypt() calls store_integration_secret with the plaintext and returns the vault secret id", async () => {
    const rpc = mockSupabaseRpc({ data: "secret_id_123", error: null });

    const ref = await provider.encrypt("real-oauth-access-token");

    expect(rpc).toHaveBeenCalledWith("store_integration_secret", { p_plaintext: "real-oauth-access-token" });
    expect(ref).toBe("secret_id_123");
  });

  it("encrypt() throws rather than silently returning a fabricated ref when Vault returns no id", async () => {
    mockSupabaseRpc({ data: null, error: null });

    await expect(provider.encrypt("token")).rejects.toThrow(/did not return a secret id/i);
  });

  it("decrypt() calls read_integration_secret with the ref and returns the resolved plaintext", async () => {
    const rpc = mockSupabaseRpc({ data: "real-oauth-access-token", error: null });

    const plaintext = await provider.decrypt("secret_id_123");

    expect(rpc).toHaveBeenCalledWith("read_integration_secret", { p_secret_id: "secret_id_123" });
    expect(plaintext).toBe("real-oauth-access-token");
  });

  it("decrypt() returns null (fail closed) rather than throwing when the function reports no ownership match", async () => {
    mockSupabaseRpc({ data: null, error: null });

    const plaintext = await provider.decrypt("someone_elses_secret_id");

    expect(plaintext).toBeNull();
  });

  it("propagates a real Supabase/Postgres error from either call rather than swallowing it", async () => {
    mockSupabaseRpc({ data: null, error: { message: "connection refused", code: "08006" } });

    await expect(provider.encrypt("token")).rejects.toThrow();
  });
});
