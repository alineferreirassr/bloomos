import type { InstagramComment, InstagramCommentStatus } from "@/types/instagramComment";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { mapInstagramCommentRow } from "@/lib/supabase/mappers";
import type { CreateInstagramCommentInput, InstagramCommentRepository } from "@/lib/data/instagramComment/repository";

const NOT_FOUND_ERROR = "This Instagram comment could not be found.";

async function createComment(input: CreateInstagramCommentInput): Promise<DataResult<InstagramComment>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("instagram_comments")
    .insert({
      workspace_id: input.workspaceId,
      instagram_account_identity_id: input.instagramAccountIdentityId,
      external_comment_id: input.externalCommentId,
      external_media_id: input.externalMediaId,
      parent_external_comment_id: input.parentExternalCommentId,
      external_author_id: input.externalAuthorId,
      external_author_username: input.externalAuthorUsername,
      content: input.content,
      external_created_at: input.externalCreatedAt,
    })
    .select("*")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") return fail("This Instagram comment has already been recorded.");
    throw normalizeSupabaseError(error);
  }
  return ok(mapInstagramCommentRow(data));
}

async function getCommentByExternalId(instagramAccountIdentityId: string, externalCommentId: string): Promise<InstagramComment | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("instagram_comments")
    .select("*")
    .eq("instagram_account_identity_id", instagramAccountIdentityId)
    .eq("external_comment_id", externalCommentId)
    .maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapInstagramCommentRow(data) : null;
}

async function getCommentById(id: string, workspaceId: string): Promise<InstagramComment | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("instagram_comments").select("*").eq("id", id).eq("workspace_id", workspaceId).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapInstagramCommentRow(data) : null;
}

async function listCommentsForWorkspace(workspaceId: string): Promise<InstagramComment[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("instagram_comments").select("*").eq("workspace_id", workspaceId);
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapInstagramCommentRow);
}

async function updateCommentStatus(id: string, status: InstagramCommentStatus): Promise<DataResult<InstagramComment>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("instagram_comments").update({ status }).eq("id", id).select("*").single();
  if (error) {
    if ((error as { code?: string }).code === "PGRST116") return fail(NOT_FOUND_ERROR);
    throw normalizeSupabaseError(error);
  }
  return ok(mapInstagramCommentRow(data));
}

export const supabaseInstagramCommentRepository: InstagramCommentRepository = {
  createComment,
  getCommentByExternalId,
  getCommentById,
  listCommentsForWorkspace,
  updateCommentStatus,
};
