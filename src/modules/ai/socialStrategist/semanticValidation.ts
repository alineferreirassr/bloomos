import type { SocialStrategistContext, SocialStrategistModelOutput, SocialStrategistReferencedContent } from "@/modules/ai/socialStrategist/types";

type SemanticResult<T> = { success: true; value: T } | { success: false; error: string };

/**
 * SOCIAL-14C — the hard-reject counterpart to `schema.ts`'s own shape-only
 * checks, mirroring `validateCrmAssistantSemantics`'s exact posture: every
 * entity the model references by id must already be present in the real,
 * already-fetched `SocialStrategistContext` — a single invented reference
 * (a Post/Idea/Inspiration/Script/Carousel id that doesn't exist) rejects
 * the whole response rather than silently rendering a partially-trusted
 * one. This is also where "does not invent a fact" is mechanically
 * enforced for structured references — the model literally cannot make up
 * a Post id and have it survive validation. Free-text fields
 * (`accountObservations`, `postingStrategyNotes`, etc.) carry the same
 * residual narrative risk every other Skill's validator already accepts —
 * this validator only ever checks structured, id-based references, never
 * prose content.
 */
export function validateSocialStrategistSemantics(output: SocialStrategistModelOutput, context: SocialStrategistContext): SemanticResult<SocialStrategistModelOutput> {
  const knownPostIds = new Set(context.posts.map((post) => post.postId));
  const knownIdeaIds = new Set(context.ideas.map((idea) => idea.ideaId));
  const knownInspirationIds = new Set(context.inspiration.map((item) => item.inspirationId));
  const knownScriptIds = new Set(context.scripts.map((item) => item.scriptId));
  const knownCarouselIds = new Set(context.carousels.map((item) => item.carouselId));

  for (const opportunity of output.contentOpportunities) {
    if (opportunity.relatedPostId !== null && !knownPostIds.has(opportunity.relatedPostId)) {
      return { success: false, error: "Bloom AI referenced a Social Post that doesn't exist in this Workspace's current data." };
    }
    if (opportunity.relatedIdeaId !== null && !knownIdeaIds.has(opportunity.relatedIdeaId)) {
      return { success: false, error: "Bloom AI referenced an Idea that doesn't exist in this Workspace's current data." };
    }
  }

  for (const recommendation of output.nextContentRecommendations) {
    if (recommendation.relatedIdeaId !== null && !knownIdeaIds.has(recommendation.relatedIdeaId)) {
      return { success: false, error: "Bloom AI referenced an Idea that doesn't exist in this Workspace's current data." };
    }
    if (recommendation.relatedInspirationId !== null && !knownInspirationIds.has(recommendation.relatedInspirationId)) {
      return { success: false, error: "Bloom AI referenced an Inspiration reference that doesn't exist in this Workspace's current data." };
    }
  }

  const knownIdsByType: Record<SocialStrategistReferencedContent["type"], Set<string>> = {
    post: knownPostIds,
    idea: knownIdeaIds,
    inspiration: knownInspirationIds,
    script: knownScriptIds,
    carousel: knownCarouselIds,
  };

  for (const reference of output.referencedContent) {
    const knownIds = knownIdsByType[reference.type];
    if (!knownIds.has(reference.id)) {
      return { success: false, error: "Bloom AI referenced a piece of content that doesn't exist in this Workspace's current data." };
    }
  }

  return { success: true, value: output };
}
