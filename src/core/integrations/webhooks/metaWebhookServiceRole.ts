import "server-only";
import { createClient as createSupabaseJsClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

/**
 * SOCIAL-11C — a new, narrow service-role boundary for the Meta webhook
 * receiver only, mirroring `automationServiceRole.ts`'s/
 * `socialSchedulerServiceRole.ts`'s own exact shape and each one's own
 * "not a shared helper" reasoning: an inbound Meta request has no
 * auth.uid() (it's Meta's own servers, not a logged-in BloomOS session),
 * so it cannot satisfy `instagram_account_identities`'/`meta_webhook_events`'
 * own `authenticated`-role RLS policies through the ordinary session-bound
 * client — this is the one place that resolves account ownership and
 * records the event via the service-role key instead, exactly the same
 * "no auth.uid(), so use service-role, and re-check every id explicitly
 * since RLS cannot help here" boundary those two modules already
 * established.
 */

const SERVICE_ROLE_ENV_VAR = "SUPABASE_SERVICE_ROLE_KEY";

export function createMetaWebhookServiceRoleClient(): SupabaseClient<Database> | null {
  const env = getPublicEnv();
  const serviceRoleKey = process.env[SERVICE_ROLE_ENV_VAR]?.trim();
  if (!env.supabaseUrl || !serviceRoleKey) return null;
  return createSupabaseJsClient<Database>(env.supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface ResolvedInstagramAccount {
  workspaceId: string;
  instagramAccountIdentityId: string;
}

/** `null` for an external account id this schema has no `instagram_account_identities` row for — never thrown, since an unresolvable delivery must still be durably recorded (see the migration's own reasoning), not treated as an error. */
export async function resolveInstagramAccountOwnership(supabase: SupabaseClient<Database>, externalAccountId: string): Promise<ResolvedInstagramAccount | null> {
  const { data, error } = await supabase.from("instagram_account_identities").select("id, workspace_id").eq("instagram_account_id", externalAccountId).maybeSingle();
  if (error || !data) return null;
  return { workspaceId: data.workspace_id, instagramAccountIdentityId: data.id };
}

export interface RecordMetaWebhookEventInput {
  /** Nullable: an unresolved delivery (no known owning workspace) has no idempotency key to claim in the first place — see the migration's own CHECK constraint tying this to `workspaceId`. */
  idempotencyKeyId: string | null;
  workspaceId: string | null;
  instagramAccountIdentityId: string | null;
  externalAccountId: string;
  objectType: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export type RecordMetaWebhookEventResult = { success: true; id: string } | { success: false; error: string };

export async function recordMetaWebhookEvent(supabase: SupabaseClient<Database>, input: RecordMetaWebhookEventInput): Promise<RecordMetaWebhookEventResult> {
  const { data, error } = await supabase
    .from("meta_webhook_events")
    .insert({
      idempotency_key_id: input.idempotencyKeyId,
      workspace_id: input.workspaceId,
      instagram_account_identity_id: input.instagramAccountIdentityId,
      external_account_id: input.externalAccountId,
      object_type: input.objectType,
      event_type: input.eventType,
      payload: input.payload,
    })
    .select("id")
    .single();
  if (error || !data) return { success: false, error: "Could not record this event." };
  return { success: true, id: data.id };
}
