import type { SocialPostStatus } from "@/core/enums/socialPostStatus";
import type { LeadStatus } from "@/core/enums/leadStatus";
import type { IdeaStatus, IdeaPriority } from "@/types/ideaItem";
import type { InspirationSourceType, InspirationContentFormat } from "@/types/inspirationItem";
import type { ScriptStatus } from "@/types/scriptItem";
import type { CarouselStatus } from "@/types/carouselItem";

/**
 * SOCIAL-14B — Social Strategist Data Context Foundation. This is the
 * server-side, workspace-scoped, read-only context layer a future
 * SOCIAL-14C strategist Skill will consume — mirroring the exact
 * `fetchXMaterials()` -> `buildXContext()` split `crmAssistant`/`dailyBrief`
 * already established (see those modules' own `fetchCrmAssistantContext.server.ts`
 * / `contextBuilder.ts` for the precedent this whole module follows).
 *
 * No Skill, no prompt, no model call, no AI provider, and no
 * `SkillCategory` addition happen anywhere in this module — those are
 * explicitly a later checkpoint's own scope (SOCIAL-14A's own audit
 * proposed SOCIAL-14C for the Skill itself). This module's only job is:
 * given an authenticated workspace, assemble a deterministic, bounded,
 * PII-minimized snapshot of real Social data.
 *
 * DELIBERATE OMISSION — raw external-user text: `leads.message` (an
 * Instagram Lead's own inbound comment/DM text), `instagram_comments.content`,
 * and `instagram_messages.content` are NEVER read by this module at all
 * (not fetched, not summarized, not truncated). SOCIAL-14A's own audit
 * found no existing precedent in this codebase for minimizing/redacting
 * *external, less-trusted* user text before it reaches an AI prompt —
 * `core/ai/promptBoundary.ts`'s injection-boundary mechanism only wraps
 * *workspace-authored* text (Ideas/Inspiration/Scripts), a different trust
 * level entirely. Rather than invent a redaction scheme with no precedent
 * to validate it against, this checkpoint keeps every such field out of
 * the strategist context entirely — `SocialStrategistInstagramLeadSummary`
 * below documents exactly which Lead fields are included/excluded and why.
 */

export interface SocialStrategistPostMetricsSummary {
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saved: number | null;
  totalInteractions: number | null;
  /** The snapshot's own capture day — never `captured_at`, matching `SocialPostMetricSnapshot`'s own real idempotency key. */
  snapshotDate: string;
}

/**
 * `caption` is included deliberately — unlike a Lead's `message`, this is
 * Amoré Bloom's own workspace-authored publishing text (the founder/staff
 * wrote it), the same trust level `Idea.hook`/`Inspiration.hook` already
 * carry elsewhere in this module, never external user input.
 */
export interface SocialStrategistPostSummary {
  postId: string;
  status: SocialPostStatus;
  caption: string;
  publishedAt: string | null;
  scheduledAt: string | null;
  createdAt: string;
  /** Null means no analytics snapshot has ever been captured for this post — never a fabricated zero. */
  metrics: SocialStrategistPostMetricsSummary | null;
}

export interface SocialStrategistAccountMetricPoint {
  metricDate: string;
  reach: number | null;
  profileViews: number | null;
}

/**
 * Null (the whole object, not just its fields) when the workspace has no
 * connected/selected Instagram account identity, or that account has never
 * had a snapshot synced — the "no data" case is never represented as a
 * fabricated zero-reach account. Follower count is deliberately absent — no
 * real column or provider metric exists for it anywhere in this codebase
 * (SOCIAL-14A's own audit finding); never invented here.
 */
export interface SocialStrategistAccountMetricsSummary {
  instagramAccountId: string;
  latest: SocialStrategistAccountMetricPoint | null;
  /** Real, persisted daily snapshots only, most recent first, bounded. Never a derived/fabricated trend line. */
  recentTrend: SocialStrategistAccountMetricPoint[];
}

export interface SocialStrategistIdeaSummary {
  ideaId: string;
  title: string;
  status: IdeaStatus;
  contentFormat: InspirationContentFormat | null;
  hook: string | null;
  cta: string | null;
  audience: string | null;
  priority: IdeaPriority | null;
  createdAt: string;
}

export interface SocialStrategistInspirationSummary {
  inspirationId: string;
  title: string;
  sourceType: InspirationSourceType;
  contentFormat: InspirationContentFormat | null;
  hook: string | null;
  cta: string | null;
  creatorHandle: string | null;
  createdAt: string;
}

/** Item-level only — no version/block resolution this checkpoint (SOCIAL-14A's own audit found no flat, workspace-scoped query for script blocks; resolving the full version chain per script is explicitly deferred, not silently attempted here). */
export interface SocialStrategistScriptSummary {
  scriptId: string;
  title: string;
  status: ScriptStatus;
  createdAt: string;
}

/** Item-level only — same reasoning as `SocialStrategistScriptSummary`, no slide resolution this checkpoint. */
export interface SocialStrategistCarouselSummary {
  carouselId: string;
  title: string;
  status: CarouselStatus;
  createdAt: string;
}

/**
 * Deliberately excludes `first_name`/`last_name`/`email`/`phone`/`message`,
 * and the raw free-text value of `assigned_to` — see this file's own
 * module-level doc comment for `message` specifically. The identity fields
 * are PII already minimized out of every other AI context builder in this
 * codebase (`CrmAssistantLeadSummary` does the same for every Lead, not
 * just Instagram-sourced ones). `instagramHandle` is the one exception:
 * the Lead's own already-public Instagram username, the same field already
 * shown throughout the Leads UI (`LeadDetailView`/`LeadListTable`), never
 * the raw external message text.
 */
export interface SocialStrategistInstagramLeadSummary {
  leadId: string;
  status: LeadStatus;
  instagramHandle: string | null;
  isAssigned: boolean;
  /** True once first_name + last_name + email are all present — the exact same guard `convertLeadToClient()` already enforces; never restates the actual name/email values. */
  hasConversionIdentity: boolean;
  createdAt: string;
}

export const SOCIAL_STRATEGIST_DATA_CATEGORIES = ["posts", "postMetrics", "accountMetrics", "ideas", "inspiration", "scripts", "carousels", "instagramLeads"] as const;
export type SocialStrategistDataCategory = (typeof SOCIAL_STRATEGIST_DATA_CATEGORIES)[number];

export interface SocialStrategistTopPost {
  postId: string;
  publishedAt: string;
  totalInteractions: number;
}

/**
 * The Social Strategist Context Builder's own output. `topPosts` is the
 * ONLY derived/ranked field this module computes — deterministic, real-data-
 * only (total_interactions descending, publishedAt descending tiebreak,
 * never includes a post lacking a real snapshot), mirroring
 * `socialAnalyticsActions.ts`'s own existing `topPosts` ranking exactly, not
 * a new heuristic. `postCountByStatus`/`instagramLeadCountByStatus` are
 * plain real tallies, not an invented "cadence" or "trend" metric — see
 * `docs`/this checkpoint's own authorization for why cadence/format-
 * breakdown/follower-count/external-trend fields are absent entirely
 * rather than approximated.
 */
export interface SocialStrategistContext {
  generatedAt: string;

  posts: SocialStrategistPostSummary[];
  postCountByStatus: Record<SocialPostStatus, number>;
  topPosts: SocialStrategistTopPost[];

  accountMetrics: SocialStrategistAccountMetricsSummary | null;

  ideas: SocialStrategistIdeaSummary[];
  inspiration: SocialStrategistInspirationSummary[];
  scripts: SocialStrategistScriptSummary[];
  carousels: SocialStrategistCarouselSummary[];

  instagramLeads: SocialStrategistInstagramLeadSummary[];
  instagramLeadCountByStatus: Record<LeadStatus, number>;
  unassignedInstagramLeadCount: number;

  /** A category name appears here only when its own read genuinely failed (Promise.allSettled rejection) — never for a real, empty result, which is a normal, gracefully-handled state (see `postCountByStatus`/etc. above, which are always present even at zero). */
  unavailableCategories: SocialStrategistDataCategory[];
}
