import type { Notification } from "@/core/notifications/types";
import type { CreateInAppNotificationInput, NotificationsRepository } from "@/lib/data/core/notifications/repository";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { mapNotificationRow } from "@/lib/supabase/mappers";

/**
 * SOCIAL-13J — the Supabase-backed sibling of `mockRepository.ts`,
 * implementing the same `NotificationsRepository` interface every internal
 * caller already depends on — not a second Notification system. Uses the
 * ordinary session-bound client (never a service-role one): `notifications`
 * has real `authenticated` RLS policies covering both real actors this
 * table has (a workspace member's own session, or a Client Portal
 * account's own session — see the migration's own doc comment), the same
 * "workspace_id is trusted only because RLS re-derives it" boundary every
 * other repository in this codebase already relies on.
 */

type SupabaseClient = ReturnType<typeof createSupabaseClient>;

const NOT_FOUND_ERROR = "Notification not found.";

async function fetchNotificationRow(supabase: SupabaseClient, id: string): Promise<Notification | null> {
  const { data, error } = await supabase.from("notifications").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapNotificationRow(data) : null;
}

async function getNotificationsForMember(workspaceId: string, recipientMemberId: string): Promise<Notification[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("recipient_member_id", recipientMemberId)
    .order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapNotificationRow);
}

async function getNotificationsForClientAccount(workspaceId: string, clientAccountId: string): Promise<Notification[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("recipient_client_account_id", clientAccountId)
    .order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapNotificationRow);
}

async function getClientPortalNotificationsForWorkspace(workspaceId: string): Promise<Notification[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("workspace_id", workspaceId)
    .not("recipient_client_account_id", "is", null)
    .order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapNotificationRow);
}

async function getMemberNotificationsForWorkspace(workspaceId: string): Promise<Notification[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("workspace_id", workspaceId)
    .not("recipient_member_id", "is", null)
    .order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapNotificationRow);
}

async function createInAppNotification(workspaceId: string, input: CreateInAppNotificationInput): Promise<DataResult<Notification>> {
  if (input.title.trim().length === 0) {
    return fail("Please fix the highlighted fields.", { title: "Title is required" });
  }
  if (!input.recipientMemberId && !input.recipientClientAccountId) {
    return fail("Please fix the highlighted fields.", { recipient: "A recipient member or client account is required" });
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      workspace_id: workspaceId,
      recipient_member_id: input.recipientMemberId ?? null,
      recipient_client_account_id: input.recipientClientAccountId ?? null,
      channel: "in_app",
      title: input.title,
      body: input.body,
      related_owner_type: input.relatedOwnerType ?? null,
      related_owner_id: input.relatedOwnerId ?? null,
      kind: input.kind ?? null,
      priority: input.priority ?? "normal",
    })
    .select("*")
    .single();

  if (error) throw normalizeSupabaseError(error);
  return ok(mapNotificationRow(data));
}

async function markNotificationRead(id: string): Promise<DataResult<Notification>> {
  const supabase = createSupabaseClient();
  const existing = await fetchNotificationRow(supabase, id);
  if (!existing) return fail(NOT_FOUND_ERROR);
  if (existing.read_at !== null) return ok(existing);

  const { data, error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);
  return ok(mapNotificationRow(data));
}

async function markNotificationUnread(id: string): Promise<DataResult<Notification>> {
  const supabase = createSupabaseClient();
  const existing = await fetchNotificationRow(supabase, id);
  if (!existing) return fail(NOT_FOUND_ERROR);
  if (existing.read_at === null) return ok(existing);

  const { data, error } = await supabase.from("notifications").update({ read_at: null }).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);
  return ok(mapNotificationRow(data));
}

async function markAllNotificationsRead(workspaceId: string, recipientMemberId: string): Promise<DataResult<number>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("recipient_member_id", recipientMemberId)
    .is("read_at", null)
    .select("id");
  if (error) throw normalizeSupabaseError(error);
  return ok((data ?? []).length);
}

async function pinNotification(id: string): Promise<DataResult<Notification>> {
  const supabase = createSupabaseClient();
  const existing = await fetchNotificationRow(supabase, id);
  if (!existing) return fail(NOT_FOUND_ERROR);

  const { data, error } = await supabase
    .from("notifications")
    .update({ pinned_at: existing.pinned_at ?? new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);
  return ok(mapNotificationRow(data));
}

async function unpinNotification(id: string): Promise<DataResult<Notification>> {
  const supabase = createSupabaseClient();
  const existing = await fetchNotificationRow(supabase, id);
  if (!existing) return fail(NOT_FOUND_ERROR);

  const { data, error } = await supabase.from("notifications").update({ pinned_at: null }).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);
  return ok(mapNotificationRow(data));
}

async function archiveNotification(id: string): Promise<DataResult<Notification>> {
  const supabase = createSupabaseClient();
  const existing = await fetchNotificationRow(supabase, id);
  if (!existing) return fail(NOT_FOUND_ERROR);

  const { data, error } = await supabase
    .from("notifications")
    .update({ archived_at: existing.archived_at ?? new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);
  return ok(mapNotificationRow(data));
}

async function unarchiveNotification(id: string): Promise<DataResult<Notification>> {
  const supabase = createSupabaseClient();
  const existing = await fetchNotificationRow(supabase, id);
  if (!existing) return fail(NOT_FOUND_ERROR);

  const { data, error } = await supabase.from("notifications").update({ archived_at: null }).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);
  return ok(mapNotificationRow(data));
}

export const supabaseNotificationsRepository: NotificationsRepository = {
  getNotificationsForMember,
  getNotificationsForClientAccount,
  getClientPortalNotificationsForWorkspace,
  getMemberNotificationsForWorkspace,
  createInAppNotification,
  markNotificationRead,
  markNotificationUnread,
  markAllNotificationsRead,
  pinNotification,
  unpinNotification,
  archiveNotification,
  unarchiveNotification,
};
