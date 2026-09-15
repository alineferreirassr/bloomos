import type { InstagramAccountIdentity } from "@/types/instagramAccountIdentity";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { mapInstagramAccountIdentityRow } from "@/lib/supabase/mappers";
import type { InstagramAccountIdentityRepository, UpsertInstagramAccountIdentityInput } from "@/lib/data/instagramAccountIdentity/repository";

const ALREADY_CLAIMED_ERROR = "This Instagram account is already connected to a different workspace.";

async function upsertInstagramAccountIdentity(input: UpsertInstagramAccountIdentityInput): Promise<DataResult<InstagramAccountIdentity>> {
  const supabase = createSupabaseClient();

  const { data: existing, error: lookupError } = await supabase
    .from("instagram_account_identities")
    .select("*")
    .eq("instagram_account_id", input.instagramAccountId)
    .maybeSingle();
  if (lookupError) throw normalizeSupabaseError(lookupError);

  if (existing && existing.workspace_id !== input.workspaceId) return fail(ALREADY_CLAIMED_ERROR);

  if (existing) {
    const { data, error } = await supabase
      .from("instagram_account_identities")
      .update({ connection_id: input.connectionId, instagram_username: input.instagramUsername })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw normalizeSupabaseError(error);
    return ok(mapInstagramAccountIdentityRow(data));
  }

  const { data, error } = await supabase
    .from("instagram_account_identities")
    .insert({
      workspace_id: input.workspaceId,
      connection_id: input.connectionId,
      instagram_account_id: input.instagramAccountId,
      instagram_username: input.instagramUsername,
    })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);
  return ok(mapInstagramAccountIdentityRow(data));
}

async function getInstagramAccountIdentityByExternalId(instagramAccountId: string): Promise<InstagramAccountIdentity | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("instagram_account_identities").select("*").eq("instagram_account_id", instagramAccountId).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapInstagramAccountIdentityRow(data) : null;
}

async function listInstagramAccountIdentitiesForWorkspace(workspaceId: string): Promise<InstagramAccountIdentity[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("instagram_account_identities").select("*").eq("workspace_id", workspaceId);
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapInstagramAccountIdentityRow);
}

export const supabaseInstagramAccountIdentityRepository: InstagramAccountIdentityRepository = {
  upsertInstagramAccountIdentity,
  getInstagramAccountIdentityByExternalId,
  listInstagramAccountIdentitiesForWorkspace,
};
