import type { SocialPost } from "@/types/socialPost";
import { socialPostDraftSchema } from "@/modules/socialPosts/schema";
import { generateId, nowIso } from "@/lib/data/utils";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { readSocialPosts, writeSocialPosts } from "@/lib/data/mock/socialPostsStore";
import type { CreateSocialPostInput, ScheduleSocialPostInput, SocialPostsRepository, UpdateSocialPostDraftInput } from "@/lib/data/socialPosts/repository";

function fieldErrorsFromZod(error: { issues: { path: PropertyKey[]; message: string }[] }): Partial<Record<string, string>> {
  const fieldErrors: Partial<Record<string, string>> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

async function listSocialPosts(workspaceId: string): Promise<SocialPost[]> {
  return readSocialPosts()
    .filter((post) => post.workspace_id === workspaceId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

async function getSocialPost(id: string): Promise<SocialPost> {
  const post = readSocialPosts().find((p) => p.id === id);
  if (!post) throw new Error(`Social post ${id} was not found`);
  return post;
}

async function createSocialPost(input: CreateSocialPostInput): Promise<DataResult<SocialPost>> {
  const parsed = socialPostDraftSchema.safeParse({ caption: input.caption, asset_id: input.assetId });
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));

  const timestamp = nowIso();
  const post: SocialPost = {
    id: generateId("social_post"),
    workspace_id: input.workspaceId,
    created_by: input.createdBy,
    status: "draft",
    caption: parsed.data.caption,
    asset_id: parsed.data.asset_id,
    target_provider: "meta",
    target_connection_id: input.connectionId,
    target_page_id: input.pageId,
    target_instagram_account_id: input.instagramAccountId,
    provider_container_id: null,
    provider_post_id: null,
    provider_permalink: null,
    provider_error: null,
    published_at: null,
    scheduled_at: null,
    scheduled_timezone: null,
    publish_attempts: 0,
    next_attempt_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
  writeSocialPosts([...readSocialPosts(), post]);
  return ok(post);
}

async function updateSocialPostDraft(id: string, input: UpdateSocialPostDraftInput): Promise<DataResult<SocialPost>> {
  const existing = readSocialPosts().find((p) => p.id === id);
  if (!existing) return fail("Social post not found.");
  if (existing.status !== "draft") return fail("Only a draft post can be edited.");

  const parsed = socialPostDraftSchema.safeParse({
    caption: input.caption ?? existing.caption,
    asset_id: input.assetId ?? existing.asset_id,
  });
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));

  const updated: SocialPost = { ...existing, caption: parsed.data.caption, asset_id: parsed.data.asset_id, updated_at: nowIso() };
  writeSocialPosts(readSocialPosts().map((p) => (p.id === id ? updated : p)));
  return ok(updated);
}

async function beginSocialPostPublish(id: string): Promise<DataResult<SocialPost>> {
  const existing = readSocialPosts().find((p) => p.id === id);
  if (!existing) return fail("Social post not found.");
  if (existing.status !== "draft" && existing.status !== "scheduled" && existing.status !== "failed") {
    return fail(existing.status === "publishing" ? "This post is already publishing." : "This post has already been published.");
  }

  const updated: SocialPost = { ...existing, status: "publishing", provider_error: null, updated_at: nowIso() };
  writeSocialPosts(readSocialPosts().map((p) => (p.id === id ? updated : p)));
  return ok(updated);
}

async function scheduleSocialPost(id: string, input: ScheduleSocialPostInput): Promise<DataResult<SocialPost>> {
  const existing = readSocialPosts().find((p) => p.id === id);
  if (!existing) return fail("Social post not found.");
  if (existing.status !== "draft" && existing.status !== "failed") {
    return fail(existing.status === "scheduled" ? "This post is already scheduled." : "This post cannot be scheduled from its current state.");
  }

  const updated: SocialPost = {
    ...existing,
    status: "scheduled",
    scheduled_at: input.scheduledAt,
    scheduled_timezone: input.scheduledTimezone,
    publish_attempts: 0,
    next_attempt_at: null,
    provider_error: null,
    updated_at: nowIso(),
  };
  writeSocialPosts(readSocialPosts().map((p) => (p.id === id ? updated : p)));
  return ok(updated);
}

async function rescheduleSocialPost(id: string, input: ScheduleSocialPostInput): Promise<DataResult<SocialPost>> {
  const existing = readSocialPosts().find((p) => p.id === id);
  if (!existing) return fail("Social post not found.");
  if (existing.status !== "scheduled") {
    return fail("This post can no longer be rescheduled — it may already be publishing or published.");
  }

  const updated: SocialPost = {
    ...existing,
    scheduled_at: input.scheduledAt,
    scheduled_timezone: input.scheduledTimezone,
    next_attempt_at: null,
    updated_at: nowIso(),
  };
  writeSocialPosts(readSocialPosts().map((p) => (p.id === id ? updated : p)));
  return ok(updated);
}

async function cancelSocialPostSchedule(id: string): Promise<DataResult<SocialPost>> {
  const existing = readSocialPosts().find((p) => p.id === id);
  if (!existing) return fail("Social post not found.");
  if (existing.status !== "scheduled") {
    return fail("This post can no longer be cancelled — it may already be publishing or published.");
  }

  const updated: SocialPost = {
    ...existing,
    status: "draft",
    scheduled_at: null,
    scheduled_timezone: null,
    next_attempt_at: null,
    updated_at: nowIso(),
  };
  writeSocialPosts(readSocialPosts().map((p) => (p.id === id ? updated : p)));
  return ok(updated);
}

async function setSocialPostContainerId(id: string, containerId: string): Promise<DataResult<SocialPost>> {
  const existing = readSocialPosts().find((p) => p.id === id);
  if (!existing) return fail("Social post not found.");

  const updated: SocialPost = { ...existing, provider_container_id: containerId, updated_at: nowIso() };
  writeSocialPosts(readSocialPosts().map((p) => (p.id === id ? updated : p)));
  return ok(updated);
}

async function markSocialPostPublished(id: string, result: { providerPostId: string; providerPermalink: string | null }): Promise<DataResult<SocialPost>> {
  const existing = readSocialPosts().find((p) => p.id === id);
  if (!existing) return fail("Social post not found.");

  const timestamp = nowIso();
  const updated: SocialPost = {
    ...existing,
    status: "published",
    provider_post_id: result.providerPostId,
    provider_permalink: result.providerPermalink,
    provider_error: null,
    published_at: timestamp,
    updated_at: timestamp,
  };
  writeSocialPosts(readSocialPosts().map((p) => (p.id === id ? updated : p)));
  return ok(updated);
}

async function markSocialPostFailed(id: string, providerError: string): Promise<DataResult<SocialPost>> {
  const existing = readSocialPosts().find((p) => p.id === id);
  if (!existing) return fail("Social post not found.");

  const updated: SocialPost = { ...existing, status: "failed", provider_error: providerError, updated_at: nowIso() };
  writeSocialPosts(readSocialPosts().map((p) => (p.id === id ? updated : p)));
  return ok(updated);
}

export const mockSocialPostsRepository: SocialPostsRepository = {
  listSocialPosts,
  getSocialPost,
  createSocialPost,
  updateSocialPostDraft,
  beginSocialPostPublish,
  setSocialPostContainerId,
  markSocialPostPublished,
  markSocialPostFailed,
  scheduleSocialPost,
  rescheduleSocialPost,
  cancelSocialPostSchedule,
};
