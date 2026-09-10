import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import type { EncryptionProvider } from "@/core/integrations/credentialManager";

/**
 * GMAIL-03P — the real `EncryptionProvider` for the PKCE `code_verifier`
 * held in `oauth_pending_authorizations`, mirroring
 * `vaultEncryptionProvider.ts`'s `SupabaseVaultEncryptionProvider` exactly.
 * `encrypt()` reuses GMAIL-02's own `store_integration_secret()` RPC —
 * creating a Vault secret has no domain-specific ownership check, so
 * that function is already safe to share across domains. `decrypt()`
 * calls a SEPARATE `read_pending_oauth_secret()` RPC (the GMAIL-03P
 * migration) rather than GMAIL-02's `read_integration_secret()`, because
 * a pending authorization is not an `integration_credentials` row and
 * checking it against that table's ownership semantics would be
 * domain-incorrect — see that migration's own header comment.
 */
export class SupabasePendingOAuthVaultProvider implements EncryptionProvider {
  async encrypt(plaintext: string): Promise<string> {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase.rpc("store_integration_secret", { p_plaintext: plaintext, p_name: "oauth_pending_code_verifier" });
    if (error) throw normalizeSupabaseError(error);
    if (!data) throw new Error("Supabase Vault did not return a secret id.");
    return data;
  }

  async decrypt(ref: string): Promise<string | null> {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase.rpc("read_pending_oauth_secret", { p_secret_id: ref });
    if (error) throw normalizeSupabaseError(error);
    return data ?? null;
  }
}
