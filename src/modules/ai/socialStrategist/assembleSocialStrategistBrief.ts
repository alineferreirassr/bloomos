import type {
  SocialStrategistContext,
  SocialStrategistModelOutput,
  SocialStrategistContentOpportunity,
  SocialStrategistNextContentRecommendation,
  SocialStrategistReferencedContent,
  SocialStrategistContentPillar,
  SocialStrategistReferencedContentType,
  SocialStrategistDataCategory,
} from "@/modules/ai/socialStrategist/types";
import type { InspirationContentFormat } from "@/types/inspirationItem";

/** No per-item detail route exists anywhere in Social's domain (Ideas/Inspiration/Scripts/Carousels/Social are each a flat list page, never `/x/[id]`) — every reference resolves to its own list page, never a fabricated detail URL. */
const LIST_HREF_BY_REFERENCE_TYPE: Record<SocialStrategistReferencedContentType, string> = {
  post: "/social",
  idea: "/ideas",
  inspiration: "/inspiration",
  script: "/scripts",
  carousel: "/carousels",
};

export interface SocialStrategistResolvedRelatedItem {
  id: string;
  title: string;
  href: string;
}

export interface SocialStrategistResolvedContentOpportunity {
  label: string;
  reason: string;
  relatedPost: SocialStrategistResolvedRelatedItem | null;
  relatedIdea: SocialStrategistResolvedRelatedItem | null;
}

export interface SocialStrategistResolvedNextContentRecommendation {
  label: string;
  reason: string;
  suggestedFormat: InspirationContentFormat | null;
  relatedIdea: SocialStrategistResolvedRelatedItem | null;
  relatedInspiration: SocialStrategistResolvedRelatedItem | null;
}

export interface SocialStrategistResolvedReference {
  type: SocialStrategistReferencedContentType;
  id: string;
  note: string;
  title: string;
  href: string;
}

/**
 * The final, UI-ready Social Strategist report — combines the validated
 * model output (narrative sections) with real context-derived stats,
 * mirroring `CrmAssistantBrief`'s own split exactly. `confidence` is passed
 * through from the model output as-is (unlike CRM Assistant, which
 * recomputes it deterministically) because `SocialStrategistModelOutput`'s
 * own `confidence` is itself already deterministically derived from real
 * context by `mockProvider.ts` (SOCIAL-14C), not a model self-report to be
 * distrusted the same way. `dataGaps` is the display name for the model's
 * own `dataSufficiencyNotes` — SOCIAL-14C's structured "not enough data"
 * channel — kept separate from `unavailableCategories` (a hard read
 * failure) so the UI can label each with its own honest explanation.
 */
export interface SocialStrategistBrief {
  accountObservations: string[];
  contentOpportunities: SocialStrategistResolvedContentOpportunity[];
  contentPillars: SocialStrategistContentPillar[];
  nextContentRecommendations: SocialStrategistResolvedNextContentRecommendation[];
  postingStrategyNotes: string[];
  audienceObservations: string[];
  referencedContent: SocialStrategistResolvedReference[];
  conversionObservations: string[];
  dataGaps: string[];
  confidence: number;

  postCount: number;
  ideaCount: number;
  inspirationCount: number;
  scriptCount: number;
  carouselCount: number;
  instagramLeadCount: number;
  hasAccountMetrics: boolean;
  unavailableCategories: SocialStrategistDataCategory[];

  /** True only when every observation/opportunity/pillar/recommendation/reference array is empty — the honest "nothing to show yet" state, never inferred from a single field. */
  isEmpty: boolean;
}

function resolvePost(context: SocialStrategistContext, postId: string | null): SocialStrategistResolvedRelatedItem | null {
  if (!postId) return null;
  const post = context.posts.find((candidate) => candidate.postId === postId);
  if (!post) return null;
  return { id: post.postId, title: post.caption, href: LIST_HREF_BY_REFERENCE_TYPE.post };
}

function resolveIdea(context: SocialStrategistContext, ideaId: string | null): SocialStrategistResolvedRelatedItem | null {
  if (!ideaId) return null;
  const idea = context.ideas.find((candidate) => candidate.ideaId === ideaId);
  if (!idea) return null;
  return { id: idea.ideaId, title: idea.title, href: LIST_HREF_BY_REFERENCE_TYPE.idea };
}

function resolveInspiration(context: SocialStrategistContext, inspirationId: string | null): SocialStrategistResolvedRelatedItem | null {
  if (!inspirationId) return null;
  const inspiration = context.inspiration.find((candidate) => candidate.inspirationId === inspirationId);
  if (!inspiration) return null;
  return { id: inspiration.inspirationId, title: inspiration.title, href: LIST_HREF_BY_REFERENCE_TYPE.inspiration };
}

function resolveContentOpportunities(opportunities: SocialStrategistContentOpportunity[], context: SocialStrategistContext): SocialStrategistResolvedContentOpportunity[] {
  return opportunities.map((opportunity) => ({
    label: opportunity.label,
    reason: opportunity.reason,
    relatedPost: resolvePost(context, opportunity.relatedPostId),
    relatedIdea: resolveIdea(context, opportunity.relatedIdeaId),
  }));
}

function resolveNextContentRecommendations(recommendations: SocialStrategistNextContentRecommendation[], context: SocialStrategistContext): SocialStrategistResolvedNextContentRecommendation[] {
  return recommendations.map((recommendation) => ({
    label: recommendation.label,
    reason: recommendation.reason,
    suggestedFormat: recommendation.suggestedFormat,
    relatedIdea: resolveIdea(context, recommendation.relatedIdeaId),
    relatedInspiration: resolveInspiration(context, recommendation.relatedInspirationId),
  }));
}

function resolveReferencedContentTitle(reference: SocialStrategistReferencedContent, context: SocialStrategistContext): string | null {
  switch (reference.type) {
    case "post":
      return context.posts.find((post) => post.postId === reference.id)?.caption ?? null;
    case "idea":
      return context.ideas.find((idea) => idea.ideaId === reference.id)?.title ?? null;
    case "inspiration":
      return context.inspiration.find((item) => item.inspirationId === reference.id)?.title ?? null;
    case "script":
      return context.scripts.find((script) => script.scriptId === reference.id)?.title ?? null;
    case "carousel":
      return context.carousels.find((carousel) => carousel.carouselId === reference.id)?.title ?? null;
  }
}

/** Semantic validation (`semanticValidation.ts`) already rejects any reference to an id absent from `context` before this function ever runs — a `null` title here would mean that guarantee failed, not a normal case, but resolution still degrades gracefully (falls back to the reference's own `id`) rather than crashing the UI. */
function resolveReferencedContent(references: SocialStrategistReferencedContent[], context: SocialStrategistContext): SocialStrategistResolvedReference[] {
  return references.map((reference) => ({
    type: reference.type,
    id: reference.id,
    note: reference.note,
    title: resolveReferencedContentTitle(reference, context) ?? reference.id,
    href: LIST_HREF_BY_REFERENCE_TYPE[reference.type],
  }));
}

export function assembleSocialStrategistBrief(modelOutput: SocialStrategistModelOutput, context: SocialStrategistContext): SocialStrategistBrief {
  const contentOpportunities = resolveContentOpportunities(modelOutput.contentOpportunities, context);
  const nextContentRecommendations = resolveNextContentRecommendations(modelOutput.nextContentRecommendations, context);
  const referencedContent = resolveReferencedContent(modelOutput.referencedContent, context);

  const isEmpty =
    modelOutput.accountObservations.length === 0 &&
    contentOpportunities.length === 0 &&
    modelOutput.contentPillars.length === 0 &&
    nextContentRecommendations.length === 0 &&
    modelOutput.postingStrategyNotes.length === 0 &&
    modelOutput.audienceObservations.length === 0 &&
    referencedContent.length === 0 &&
    modelOutput.conversionObservations.length === 0;

  return {
    accountObservations: modelOutput.accountObservations,
    contentOpportunities,
    contentPillars: modelOutput.contentPillars,
    nextContentRecommendations,
    postingStrategyNotes: modelOutput.postingStrategyNotes,
    audienceObservations: modelOutput.audienceObservations,
    referencedContent,
    conversionObservations: modelOutput.conversionObservations,
    dataGaps: modelOutput.dataSufficiencyNotes,
    confidence: modelOutput.confidence,

    postCount: context.posts.length,
    ideaCount: context.ideas.length,
    inspirationCount: context.inspiration.length,
    scriptCount: context.scripts.length,
    carouselCount: context.carousels.length,
    instagramLeadCount: context.instagramLeads.length,
    hasAccountMetrics: context.accountMetrics !== null,
    unavailableCategories: context.unavailableCategories,

    isEmpty,
  };
}
