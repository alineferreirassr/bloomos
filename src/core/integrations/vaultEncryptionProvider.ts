import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import type { EncryptionProvider } from "@/core/integrations/credentialManager";

/**
 * GMAIL-02 — the real `EncryptionProvider`, backed by Supabase Vault
 * (`pgsodium`, root key held outside the database by the platform — never
 * a key this repository invents, stores, or commits). `encrypt()` calls
 * `public.store_integration_secret()`; `decrypt()` calls
 * `public.read_integration_secret()` — both SECURITY DEFINER Postgres
 * functions from the GMAIL-02 migration. Neither function is ever passed
 * a real third-party token yet (no live Google OAuth client is configured
 * — see `docs/oauth-engine.md`'s own addendum); this provider exists so
 * the shape is correct for when one is, same precedent `GmailProvider`
 * itself already established.
 *
 * `read_integration_secret()` independently re-verifies the caller's own
 * workspace/member ownership of the `integration_credentials` row that
 * references the given id before ever reading `vault.decrypted_secrets` —
 * this provider does not duplicate that check, it only surfaces whatever
 * the function decides (`null` for "not found or not yours", matching
 * this codebase's own "fail closed, return null" credential-resolution
 * precedent).
 */
export class SupabaseVaultEncryptionProvider implements EncryptionProvider {
  async encrypt(plaintext: string): Promise<string> {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase.rpc("store_integration_secret", { p_plaintext: plaintext });
    if (error) throw normalizeSupabaseError(error);
    if (!data) throw new Error("Supabase Vault did not return a secret id.");
    return data;
  }

  async decrypt(ref: string): Promise<string | null> {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase.rpc("read_integration_secret", { p_secret_id: ref });
    if (error) throw normalizeSupabaseError(error);
    return data ?? null;
  }
}
