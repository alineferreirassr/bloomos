import { getDataMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { mapSocialPostRow, mapSocialPostMetricSnapshotRow, mapSocialAccountMetricSnapshotRow, mapInstagramAccountIdentityRow, mapIdeaItemRow, mapInspirationItemRow, mapScriptItemRow, mapCarouselItemRow, mapLeadRow } from "@/lib/supabase/mappers";
import {
  listSocialPosts,
  listLatestSocialPostMetricSnapshotsForWorkspace,
  listSocialAccountMetricSnapshots,
  listInstagramAccountIdentitiesForWorkspace,
  listIdeaItems,
  listInspirationItems,
  listScriptItems,
  listCarouselItems,
  getLeads,
} from "@/lib/data";
import type { SocialPost } from "@/types/socialPost";
import type { SocialPostMetricSnapshot, SocialAccountMetricSnapshot } from "@/types/socialMetricSnapshot";
import type { InstagramAccountIdentity } from "@/types/instagramAccountIdentity";
import type { IdeaItem } from "@/types/ideaItem";
import type { InspirationItem } from "@/types/inspirationItem";
import type { ScriptItem } from "@/types/scriptItem";
import type { CarouselItem } from "@/types/carouselItem";
import type { Lead } from "@/types/lead";
import type { SocialStrategistDataCategory } from "@/modules/ai/socialStrategist/types";

/**
 * SOCIAL-14B — the raw-materials half of `crmAssistant`/`dailyBrief`'s own
 * `fetchXMaterials()` -> `buildXContext()` split. Every function here is
 * "safe to call as-is in mock mode, needs its own direct query in supabase
 * mode" — the exact same constraint `fetchCrmAssistantContext.server.ts`'s
 * own doc comment already documents: every `@/lib/data` repository facade
 * used here (`listSocialPosts`, `getLeads`, etc.) is wired to the *browser*
 * Supabase client in `"supabase"` data mode and throws "Authentication is
 * required." if called from real server-side code — so this file mirrors
 * that established precedent exactly: the mock-mode branch calls the
 * existing facade directly, the supabase-mode branch runs its own query
 * through `@/lib/supabase/server`'s cookie-aware, RLS-bound client (never a
 * service-role client — see this module's own boundary requirements).
 *
 * Every query here is explicitly `.eq("workspace_id", workspaceId)`-scoped
 * even though RLS also enforces it — belt-and-suspenders, matching this
 * codebase's own "workspace_id is trusted only because RLS re-derives it,
 * never assumed from a single layer" discipline. `workspaceId` is always
 * the caller's own session-derived id (see `contextBuilder.ts`'s and the
 * future Skill's own doc comments) — never read from `refs`/`facts` here.
 */

const POST_SAFETY_LIMIT = 500;
const POST_METRIC_SNAPSHOT_SAFETY_LIMIT = 2000;
const ACCOUNT_METRIC_SNAPSHOT_SAFETY_LIMIT = 400;
const CONTENT_ITEM_SAFETY_LIMIT = 500;
const INSTAGRAM_LEAD_SAFETY_LIMIT = 1000;

async function fetchPostsSupabase(workspaceId: string): Promise<SocialPost[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("social_posts").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(POST_SAFETY_LIMIT);
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapSocialPostRow);
}

function fetchPosts(workspaceId: string): Promise<SocialPost[]> {
  return getDataMode() !== "supabase" ? listSocialPosts(workspaceId) : fetchPostsSupabase(workspaceId);
}

/** Latest snapshot per post only — mirrors `listLatestSocialPostMetricSnapshotsForWorkspace`'s own contract exactly; the supabase branch reimplements the same "latest per post" reduction since no flat query for it exists at the DB layer. */
async function fetchLatestPostMetricsSupabase(workspaceId: string, socialPostIds: string[]): Promise<SocialPostMetricSnapshot[]> {
  if (socialPostIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("social_post_metric_snapshots")
    .select("*")
    .eq("workspace_id", workspaceId)
    .in("social_post_id", socialPostIds)
    .order("snapshot_date", { ascending: false })
    .limit(POST_METRIC_SNAPSHOT_SAFETY_LIMIT);
  if (error) throw normalizeSupabaseError(error);
  const rows = (data ?? []).map(mapSocialPostMetricSnapshotRow);
  const latestByPostId = new Map<string, SocialPostMetricSnapshot>();
  for (const row of rows) {
    if (!latestByPostId.has(row.social_post_id)) latestByPostId.set(row.social_post_id, row);
  }
  return [...latestByPostId.values()];
}

function fetchLatestPostMetrics(workspaceId: string, socialPostIds: string[]): Promise<SocialPostMetricSnapshot[]> {
  return getDataMode() !== "supabase" ? listLatestSocialPostMetricSnapshotsForWorkspace(workspaceId, socialPostIds) : fetchLatestPostMetricsSupabase(workspaceId, socialPostIds);
}

async function fetchInstagramAccountIdentitiesSupabase(workspaceId: string): Promise<InstagramAccountIdentity[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("instagram_account_identities").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapInstagramAccountIdentityRow);
}

function fetchInstagramAccountIdentities(workspaceId: string): Promise<InstagramAccountIdentity[]> {
  return getDataMode() !== "supabase" ? listInstagramAccountIdentitiesForWorkspace(workspaceId) : fetchInstagramAccountIdentitiesSupabase(workspaceId);
}

async function fetchAccountMetricsSupabase(workspaceId: string, instagramAccountId: string): Promise<SocialAccountMetricSnapshot[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("social_account_metric_snapshots")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("instagram_account_id", instagramAccountId)
    .order("metric_date", { ascending: false })
    .limit(ACCOUNT_METRIC_SNAPSHOT_SAFETY_LIMIT);
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapSocialAccountMetricSnapshotRow);
}

function fetchAccountMetrics(workspaceId: string, instagramAccountId: string): Promise<SocialAccountMetricSnapshot[]> {
  return getDataMode() !== "supabase" ? listSocialAccountMetricSnapshots(workspaceId, instagramAccountId) : fetchAccountMetricsSupabase(workspaceId, instagramAccountId);
}

async function fetchIdeasSupabase(workspaceId: string): Promise<IdeaItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("idea_items").select("*").eq("workspace_id", workspaceId).is("archived_at", null).order("created_at", { ascending: false }).limit(CONTENT_ITEM_SAFETY_LIMIT);
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapIdeaItemRow);
}

function fetchIdeas(workspaceId: string): Promise<IdeaItem[]> {
  return getDataMode() !== "supabase" ? listIdeaItems(workspaceId, { archived: "active" }) : fetchIdeasSupabase(workspaceId);
}

async function fetchInspirationSupabase(workspaceId: string): Promise<InspirationItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("inspiration_items").select("*").eq("workspace_id", workspaceId).is("archived_at", null).order("created_at", { ascending: false }).limit(CONTENT_ITEM_SAFETY_LIMIT);
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapInspirationItemRow);
}

function fetchInspiration(workspaceId: string): Promise<InspirationItem[]> {
  return getDataMode() !== "supabase" ? listInspirationItems(workspaceId, { archived: "active" }) : fetchInspirationSupabase(workspaceId);
}

async function fetchScriptsSupabase(workspaceId: string): Promise<ScriptItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("script_items").select("*").eq("workspace_id", workspaceId).is("archived_at", null).order("created_at", { ascending: false }).limit(CONTENT_ITEM_SAFETY_LIMIT);
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapScriptItemRow);
}

function fetchScripts(workspaceId: string): Promise<ScriptItem[]> {
  return getDataMode() !== "supabase" ? listScriptItems(workspaceId, { archived: "active" }) : fetchScriptsSupabase(workspaceId);
}

async function fetchCarouselsSupabase(workspaceId: string): Promise<CarouselItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("carousel_items").select("*").eq("workspace_id", workspaceId).is("archived_at", null).order("created_at", { ascending: false }).limit(CONTENT_ITEM_SAFETY_LIMIT);
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapCarouselItemRow);
}

function fetchCarousels(workspaceId: string): Promise<CarouselItem[]> {
  return getDataMode() !== "supabase" ? listCarouselItems(workspaceId, { archived: "active" }) : fetchCarouselsSupabase(workspaceId);
}

/** Instagram-sourced Leads only (`source = "Instagram"`) — every other Lead source is out of this module's scope by the checkpoint's own authorization. */
async function fetchInstagramLeadsSupabase(workspaceId: string): Promise<Lead[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("source", "Instagram")
    .order("created_at", { ascending: false })
    .limit(INSTAGRAM_LEAD_SAFETY_LIMIT);
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapLeadRow);
}

function fetchInstagramLeads(workspaceId: string): Promise<Lead[]> {
  return getDataMode() !== "supabase" ? getLeads({ source: "Instagram", includeArchived: false }) : fetchInstagramLeadsSupabase(workspaceId);
}

export interface SocialStrategistMaterials {
  posts: SocialPost[];
  postMetricsByPostId: Map<string, SocialPostMetricSnapshot>;
  /** Null when the workspace has no Instagram account identity at all — a real "not connected" state, never treated as a failed read. */
  instagramAccountId: string | null;
  accountMetrics: SocialAccountMetricSnapshot[];
  ideas: IdeaItem[];
  inspiration: InspirationItem[];
  scripts: ScriptItem[];
  carousels: CarouselItem[];
  instagramLeads: Lead[];
  unavailableCategories: SocialStrategistDataCategory[];
}

function settledOr<T>(result: PromiseSettledResult<T>, fallback: T, category: SocialStrategistDataCategory, unavailable: SocialStrategistDataCategory[]): T {
  if (result.status === "fulfilled") return result.value;
  unavailable.push(category);
  return fallback;
}

/**
 * Fetches every raw material `contextBuilder.ts` classifies into a
 * `SocialStrategistContext`. Posts are fetched first (post-metrics and
 * top-post ranking both need real post ids to look up), everything else
 * runs independently via `Promise.allSettled` — a single failing data
 * source never blanks out the rest of the context, mirroring
 * `fetchCrmAssistantMaterials`'s own resilience pattern exactly.
 */
export async function fetchSocialStrategistMaterials(workspaceId: string): Promise<SocialStrategistMaterials> {
  const unavailableCategories: SocialStrategistDataCategory[] = [];

  const postsResult = await Promise.allSettled([fetchPosts(workspaceId)]);
  const posts = settledOr(postsResult[0], [], "posts", unavailableCategories);

  const [postMetricsResult, identitiesResult, ideasResult, inspirationResult, scriptsResult, carouselsResult, instagramLeadsResult] = await Promise.allSettled([
    posts.length > 0 ? fetchLatestPostMetrics(workspaceId, posts.map((post) => post.id)) : Promise.resolve([]),
    fetchInstagramAccountIdentities(workspaceId),
    fetchIdeas(workspaceId),
    fetchInspiration(workspaceId),
    fetchScripts(workspaceId),
    fetchCarousels(workspaceId),
    fetchInstagramLeads(workspaceId),
  ]);

  const postMetrics = settledOr(postMetricsResult, [], "postMetrics", unavailableCategories);
  const postMetricsByPostId = new Map(postMetrics.map((snapshot) => [snapshot.social_post_id, snapshot]));

  const identities = settledOr(identitiesResult, [], "accountMetrics", unavailableCategories);
  const instagramAccountId = identities[0]?.instagram_account_id ?? null;

  let accountMetrics: SocialAccountMetricSnapshot[] = [];
  if (instagramAccountId) {
    const accountMetricsResult = await Promise.allSettled([fetchAccountMetrics(workspaceId, instagramAccountId)]);
    accountMetrics = settledOr(accountMetricsResult[0], [], "accountMetrics", unavailableCategories);
  }

  const ideas = settledOr(ideasResult, [], "ideas", unavailableCategories);
  const inspiration = settledOr(inspirationResult, [], "inspiration", unavailableCategories);
  const scripts = settledOr(scriptsResult, [], "scripts", unavailableCategories);
  const carousels = settledOr(carouselsResult, [], "carousels", unavailableCategories);
  const instagramLeads = settledOr(instagramLeadsResult, [], "instagramLeads", unavailableCategories);

  return {
    posts,
    postMetricsByPostId,
    instagramAccountId,
    accountMetrics,
    ideas,
    inspiration,
    scripts,
    carousels,
    instagramLeads,
    unavailableCategories,
  };
}
