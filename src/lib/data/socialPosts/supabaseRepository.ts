import type { SocialPost } from "@/types/socialPost";
import { socialPostDraftSchema } from "@/modules/socialPosts/schema";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { mapSocialPostRow } from "@/lib/supabase/mappers";
import { UnauthorizedError, ForbiddenError } from "@/core/errors";
import { getClientWorkspaceSession, type WorkspaceSession } from "@/lib/auth/workspaceSessionClient";
import type { CreateSocialPostInput, SocialPostsRepository, UpdateSocialPostDraftInput } from "@/lib/data/socialPosts/repository";

type SupabaseClient = ReturnType<typeof createSupabaseClient>;

function fieldErrorsFromZod(error: { issues: { path: PropertyKey[]; message: string }[] }): Partial<Record<string, string>> {
  const fieldErrors: Partial<Record<string, string>> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

/** Same rationale as every other domain's own requireWorkspaceSession. */
async function requireWorkspaceSession(): Promise<WorkspaceSession> {
  const result = await getClientWorkspaceSession();
  if (result.status === "unauthenticated") throw new UnauthorizedError("Authentication is required.");
  if (result.status === "no-workspace") throw new ForbiddenError("You don't have permission to do that.");
  return result.session;
}

async function fetchSocialPostRow(supabase: SupabaseClient, id: string): Promise<SocialPost | null> {
  const { data, error } = await supabase.from("social_posts").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapSocialPostRow(data) : null;
}

async function listSocialPosts(workspaceId: string): Promise<SocialPost[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("social_posts").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapSocialPostRow);
}

async function getSocialPost(id: string): Promise<SocialPost> {
  const supabase = createSupabaseClient();
  const post = await fetchSocialPostRow(supabase, id);
  if (!post) throw new Error(`Social post ${id} was not found`);
  return post;
}

async function createSocialPost(input: CreateSocialPostInput): Promise<DataResult<SocialPost>> {
  const parsed = socialPostDraftSchema.safeParse({ caption: input.caption, asset_id: input.assetId });
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));

  await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("social_posts")
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.createdBy,
      caption: parsed.data.caption,
      asset_id: parsed.data.asset_id,
      target_connection_id: input.connectionId,
      target_page_id: input.pageId,
      target_instagram_account_id: input.instagramAccountId,
    })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  return ok(mapSocialPostRow(data));
}

async function updateSocialPostDraft(id: string, input: UpdateSocialPostDraftInput): Promise<DataResult<SocialPost>> {
  const supabase = createSupabaseClient();
  const existing = await fetchSocialPostRow(supabase, id);
  if (!existing) return fail("Social post not found.");
  if (existing.status !== "draft") return fail("Only a draft post can be edited.");

  const parsed = socialPostDraftSchema.safeParse({ caption: input.caption ?? existing.caption, asset_id: input.assetId ?? existing.asset_id });
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));

  await requireWorkspaceSession();
  const { data, error } = await supabase
    .from("social_posts")
    .update({ caption: parsed.data.caption, asset_id: parsed.data.asset_id })
    .eq("id", id)
    .eq("status", "draft")
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  return ok(mapSocialPostRow(data));
}

/**
 * The real idempotency guard: a single conditional `UPDATE ... WHERE
 * status IN ('draft','failed')` is atomic at the Postgres row-lock level —
 * a concurrent second "Publish Now" click racing this one sees zero rows
 * match (the first request's own UPDATE already moved the row to
 * `publishing`) and gets `.single()`'s own "no rows" error, never a second
 * publish. This is not "check then write" from the application layer; the
 * database itself is what prevents the race.
 */
async function beginSocialPostPublish(id: string): Promise<DataResult<SocialPost>> {
  await requireWorkspaceSession();
  const supabase = createSupabaseClient();

  const existing = await fetchSocialPostRow(supabase, id);
  if (!existing) return fail("Social post not found.");

  const { data, error } = await supabase
    .from("social_posts")
    .update({ status: "publishing", provider_error: null })
    .eq("id", id)
    .in("status", ["draft", "failed"])
    .select("*")
    .maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  if (!data) {
    return fail(existing.status === "publishing" ? "This post is already publishing." : "This post has already been published.");
  }

  return ok(mapSocialPostRow(data));
}

async function setSocialPostContainerId(id: string, containerId: string): Promise<DataResult<SocialPost>> {
  await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("social_posts").update({ provider_container_id: containerId }).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);
  return ok(mapSocialPostRow(data));
}

async function markSocialPostPublished(id: string, result: { providerPostId: string; providerPermalink: string | null }): Promise<DataResult<SocialPost>> {
  await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("social_posts")
    .update({ status: "published", provider_post_id: result.providerPostId, provider_permalink: result.providerPermalink, provider_error: null, published_at: timestamp })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);
  return ok(mapSocialPostRow(data));
}

async function markSocialPostFailed(id: string, providerError: string): Promise<DataResult<SocialPost>> {
  await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("social_posts").update({ status: "failed", provider_error: providerError }).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);
  return ok(mapSocialPostRow(data));
}

export const supabaseSocialPostsRepository: SocialPostsRepository = {
  listSocialPosts,
  getSocialPost,
  createSocialPost,
  updateSocialPostDraft,
  beginSocialPostPublish,
  setSocialPostContainerId,
  markSocialPostPublished,
  markSocialPostFailed,
};
