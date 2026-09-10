import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import type { Database } from "@/types/database.types";
import type { ConnectionStateTransition, IntegrationConnection } from "@/core/integrations/types";

/**
 * GMAIL-02 — the real, durable counterpart to `connectionStore.ts`'s mock
 * implementation. Holds no secret material of its own — `config` is the
 * same free-form, non-secret provider settings the mock store already
 * held (e.g. Stripe's `mode`); the actual token/secret lives only in
 * `integration_credentials`, resolved via `credential_id`. Uses the
 * server-only Supabase client, same rationale as `supabaseCredentialStore.ts`.
 */
type ConnectionRow = Database["public"]["Tables"]["integration_connections"]["Row"];
type TransitionRow = Database["public"]["Tables"]["integration_connection_transitions"]["Row"];

function mapConnectionRow(row: ConnectionRow): IntegrationConnection {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    member_id: row.member_id,
    provider_id: row.provider_id,
    state: row.state as IntegrationConnection["state"],
    config: row.config,
    credential_id: row.credential_id,
    capabilities: row.capabilities as IntegrationConnection["capabilities"],
    version: row.version,
    installed_by: row.installed_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_state_change_at: row.last_state_change_at,
    last_health_check_at: row.last_health_check_at,
    last_sync_at: row.last_sync_at,
    failure_count: row.failure_count,
    retry_count: row.retry_count,
  };
}

function mapTransitionRow(row: TransitionRow): ConnectionStateTransition {
  return {
    id: row.id,
    connection_id: row.connection_id,
    from_state: row.from_state as ConnectionStateTransition["from_state"],
    to_state: row.to_state as ConnectionStateTransition["to_state"],
    event: row.event as ConnectionStateTransition["event"],
    occurred_at: row.occurred_at,
    note: row.note,
  };
}

export async function insertConnection(connection: IntegrationConnection): Promise<IntegrationConnection> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("integration_connections")
    .insert({
      id: connection.id,
      workspace_id: connection.workspace_id,
      member_id: connection.member_id,
      provider_id: connection.provider_id,
      state: connection.state,
      config: connection.config,
      credential_id: connection.credential_id,
      capabilities: connection.capabilities,
      version: connection.version,
      installed_by: connection.installed_by,
    })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);
  return mapConnectionRow(data);
}

export async function getConnectionById(id: string): Promise<IntegrationConnection | null> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.from("integration_connections").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapConnectionRow(data) : null;
}

export async function listConnectionsForWorkspace(workspaceId: string): Promise<IntegrationConnection[]> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("integration_connections")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapConnectionRow);
}

export async function updateConnection(id: string, patch: Partial<IntegrationConnection>): Promise<IntegrationConnection | null> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("integration_connections")
    .update({
      ...(patch.state !== undefined ? { state: patch.state } : {}),
      ...(patch.config !== undefined ? { config: patch.config } : {}),
      ...(patch.credential_id !== undefined ? { credential_id: patch.credential_id } : {}),
      ...(patch.capabilities !== undefined ? { capabilities: patch.capabilities } : {}),
      ...(patch.version !== undefined ? { version: patch.version } : {}),
      ...(patch.last_state_change_at !== undefined ? { last_state_change_at: patch.last_state_change_at } : {}),
      ...(patch.last_health_check_at !== undefined ? { last_health_check_at: patch.last_health_check_at } : {}),
      ...(patch.last_sync_at !== undefined ? { last_sync_at: patch.last_sync_at } : {}),
      ...(patch.failure_count !== undefined ? { failure_count: patch.failure_count } : {}),
      ...(patch.retry_count !== undefined ? { retry_count: patch.retry_count } : {}),
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapConnectionRow(data) : null;
}

export async function deleteConnection(id: string): Promise<boolean> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.from("integration_connections").delete().eq("id", id).select("id");
  if (error) throw normalizeSupabaseError(error);
  return (data?.length ?? 0) > 0;
}

export async function insertTransition(transition: ConnectionStateTransition): Promise<ConnectionStateTransition> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("integration_connection_transitions")
    .insert({
      id: transition.id,
      connection_id: transition.connection_id,
      from_state: transition.from_state,
      to_state: transition.to_state,
      event: transition.event,
      note: transition.note,
    })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);
  return mapTransitionRow(data);
}

export async function listTransitionsForConnection(connectionId: string): Promise<ConnectionStateTransition[]> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("integration_connection_transitions")
    .select("*")
    .eq("connection_id", connectionId)
    .order("occurred_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapTransitionRow);
}
