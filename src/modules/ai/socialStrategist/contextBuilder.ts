import { clockNow } from "@/core/time/clock";
import { SOCIAL_POST_STATUSES, type SocialPostStatus } from "@/core/enums/socialPostStatus";
import { LEAD_STATUSES, type LeadStatus } from "@/core/enums/leadStatus";
import type { SocialStrategistMaterials } from "@/modules/ai/socialStrategist/fetchSocialStrategistContext.server";
import type {
  SocialStrategistContext,
  SocialStrategistPostSummary,
  SocialStrategistPostMetricsSummary,
  SocialStrategistAccountMetricsSummary,
  SocialStrategistAccountMetricPoint,
  SocialStrategistIdeaSummary,
  SocialStrategistInspirationSummary,
  SocialStrategistScriptSummary,
  SocialStrategistCarouselSummary,
  SocialStrategistInstagramLeadSummary,
  SocialStrategistTopPost,
} from "@/modules/ai/socialStrategist/types";

export const SOCIAL_STRATEGIST_CONTEXT_VERSION = "social-strategist-context-v1";

const RECENT_POSTS_LIMIT = 50;
const ACCOUNT_TREND_LIMIT = 30;
const CONTENT_ITEM_LIMIT = 50;
const INSTAGRAM_LEADS_LIMIT = 100;
const TOP_POSTS_LIMIT = 5;

function toPostMetricsSummary(materials: SocialStrategistMaterials, postId: string): SocialStrategistPostMetricsSummary | null {
  const snapshot = materials.postMetricsByPostId.get(postId);
  if (!snapshot) return null;
  return {
    views: snapshot.views,
    reach: snapshot.reach,
    likes: snapshot.likes,
    comments: snapshot.comments,
    shares: snapshot.shares,
    saved: snapshot.saved,
    totalInteractions: snapshot.total_interactions,
    snapshotDate: snapshot.snapshot_date,
  };
}

function toPostSummary(materials: SocialStrategistMaterials, post: SocialStrategistMaterials["posts"][number]): SocialStrategistPostSummary {
  return {
    postId: post.id,
    status: post.status,
    caption: post.caption,
    publishedAt: post.published_at,
    scheduledAt: post.scheduled_at,
    createdAt: post.created_at,
    metrics: toPostMetricsSummary(materials, post.id),
  };
}

function countByStatus<TStatus extends string>(statuses: readonly TStatus[], items: { status: TStatus }[]): Record<TStatus, number> {
  const counts = Object.fromEntries(statuses.map((status) => [status, 0])) as Record<TStatus, number>;
  for (const item of items) {
    counts[item.status] += 1;
  }
  return counts;
}

/** Real data only, mirroring `socialAnalyticsActions.ts`'s own `topPosts` ranking exactly: total_interactions descending, publishedAt descending tiebreak, never a post lacking a real snapshot. */
function computeTopPosts(posts: SocialStrategistPostSummary[]): SocialStrategistTopPost[] {
  return posts
    .filter((post): post is SocialStrategistPostSummary & { publishedAt: string; metrics: SocialStrategistPostMetricsSummary & { totalInteractions: number } } => post.publishedAt !== null && post.metrics !== null && post.metrics.totalInteractions !== null)
    .map((post) => ({ postId: post.postId, publishedAt: post.publishedAt, totalInteractions: post.metrics.totalInteractions }))
    .sort((a, b) => {
      const byInteractions = b.totalInteractions - a.totalInteractions;
      if (byInteractions !== 0) return byInteractions;
      return b.publishedAt.localeCompare(a.publishedAt);
    })
    .slice(0, TOP_POSTS_LIMIT);
}

function toAccountMetricPoint(snapshot: SocialStrategistMaterials["accountMetrics"][number]): SocialStrategistAccountMetricPoint {
  return { metricDate: snapshot.metric_date, reach: snapshot.reach, profileViews: snapshot.profile_views };
}

function buildAccountMetrics(materials: SocialStrategistMaterials): SocialStrategistAccountMetricsSummary | null {
  if (!materials.instagramAccountId) return null;
  if (materials.accountMetrics.length === 0) return { instagramAccountId: materials.instagramAccountId, latest: null, recentTrend: [] };

  const sorted = materials.accountMetrics.slice().sort((a, b) => b.metric_date.localeCompare(a.metric_date));
  return {
    instagramAccountId: materials.instagramAccountId,
    latest: toAccountMetricPoint(sorted[0]),
    recentTrend: sorted.slice(0, ACCOUNT_TREND_LIMIT).map(toAccountMetricPoint),
  };
}

function toIdeaSummary(idea: SocialStrategistMaterials["ideas"][number]): SocialStrategistIdeaSummary {
  return { ideaId: idea.id, title: idea.title, status: idea.status, contentFormat: idea.content_format, hook: idea.hook, cta: idea.cta, audience: idea.audience, priority: idea.priority, createdAt: idea.created_at };
}

function toInspirationSummary(item: SocialStrategistMaterials["inspiration"][number]): SocialStrategistInspirationSummary {
  return { inspirationId: item.id, title: item.title, sourceType: item.source_type, contentFormat: item.content_format, hook: item.hook, cta: item.cta, creatorHandle: item.creator_handle, createdAt: item.created_at };
}

function toScriptSummary(item: SocialStrategistMaterials["scripts"][number]): SocialStrategistScriptSummary {
  return { scriptId: item.id, title: item.title, status: item.status, createdAt: item.created_at };
}

function toCarouselSummary(item: SocialStrategistMaterials["carousels"][number]): SocialStrategistCarouselSummary {
  return { carouselId: item.id, title: item.title, status: item.status, createdAt: item.created_at };
}

/** See `types.ts`'s own doc comment — `message`/`first_name`/`last_name`/`email`/`phone` and the raw `assigned_to` value are never read here. */
function toInstagramLeadSummary(lead: SocialStrategistMaterials["instagramLeads"][number]): SocialStrategistInstagramLeadSummary {
  return {
    leadId: lead.id,
    status: lead.status,
    instagramHandle: lead.instagram,
    isAssigned: lead.assigned_to !== null,
    hasConversionIdentity: Boolean(lead.first_name && lead.last_name && lead.email),
    createdAt: lead.created_at,
  };
}

/**
 * Pure and deterministic — the only place `SocialStrategistContext` is
 * assembled, mirroring `buildCrmAssistantContext`'s own shape exactly.
 * Every list here is sorted newest-first and sliced to its own bounded
 * limit — boundedness happens here, not in the fetch layer, matching
 * `classifyActiveLeads`'s own "fetch raw, bound in the builder" split.
 */
export function buildSocialStrategistContext(materials: SocialStrategistMaterials, now: Date = clockNow()): SocialStrategistContext {
  const posts = materials.posts
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, RECENT_POSTS_LIMIT)
    .map((post) => toPostSummary(materials, post));

  const postCountByStatus = countByStatus<SocialPostStatus>(SOCIAL_POST_STATUSES, materials.posts);
  const topPosts = computeTopPosts(posts);
  const accountMetrics = buildAccountMetrics(materials);

  const ideas = materials.ideas
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, CONTENT_ITEM_LIMIT)
    .map(toIdeaSummary);

  const inspiration = materials.inspiration
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, CONTENT_ITEM_LIMIT)
    .map(toInspirationSummary);

  const scripts = materials.scripts
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, CONTENT_ITEM_LIMIT)
    .map(toScriptSummary);

  const carousels = materials.carousels
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, CONTENT_ITEM_LIMIT)
    .map(toCarouselSummary);

  const instagramLeads = materials.instagramLeads
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, INSTAGRAM_LEADS_LIMIT)
    .map(toInstagramLeadSummary);

  const instagramLeadCountByStatus = countByStatus<LeadStatus>(LEAD_STATUSES, materials.instagramLeads);
  const unassignedInstagramLeadCount = materials.instagramLeads.filter((lead) => lead.assigned_to === null).length;

  return {
    generatedAt: now.toISOString(),
    posts,
    postCountByStatus,
    topPosts,
    accountMetrics,
    ideas,
    inspiration,
    scripts,
    carousels,
    instagramLeads,
    instagramLeadCountByStatus,
    unassignedInstagramLeadCount,
    unavailableCategories: materials.unavailableCategories,
  };
}
