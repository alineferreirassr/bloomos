import { z } from "zod";
import { INSPIRATION_CONTENT_FORMATS } from "@/types/inspirationItem";
import { SOCIAL_STRATEGIST_REFERENCED_CONTENT_TYPES } from "@/modules/ai/socialStrategist/types";

const OBSERVATION_MAX_LENGTH = 280;
const LABEL_MAX_LENGTH = 120;
const REASON_MAX_LENGTH = 280;
const NOTE_MAX_LENGTH = 200;

const observationArraySchema = z.array(z.string().trim().min(1).max(OBSERVATION_MAX_LENGTH)).max(5);

const socialStrategistContentOpportunitySchema = z.object({
  label: z.string().trim().min(1).max(LABEL_MAX_LENGTH),
  reason: z.string().trim().min(1).max(REASON_MAX_LENGTH),
  relatedPostId: z.string().trim().min(1).nullable(),
  relatedIdeaId: z.string().trim().min(1).nullable(),
});

const socialStrategistContentPillarSchema = z.object({
  name: z.string().trim().min(1).max(80),
  rationale: z.string().trim().min(1).max(REASON_MAX_LENGTH),
});

const socialStrategistNextContentRecommendationSchema = z.object({
  label: z.string().trim().min(1).max(LABEL_MAX_LENGTH),
  reason: z.string().trim().min(1).max(REASON_MAX_LENGTH),
  suggestedFormat: z.enum(INSPIRATION_CONTENT_FORMATS).nullable(),
  relatedIdeaId: z.string().trim().min(1).nullable(),
  relatedInspirationId: z.string().trim().min(1).nullable(),
});

const socialStrategistReferencedContentSchema = z.object({
  type: z.enum(SOCIAL_STRATEGIST_REFERENCED_CONTENT_TYPES),
  id: z.string().trim().min(1),
  note: z.string().trim().min(1).max(NOTE_MAX_LENGTH),
});

/**
 * SOCIAL-14C — bounded, closed shape, no partial trust; mirrors
 * `crmAssistantModelOutputSchema`'s own guarantees exactly. Every array has
 * an explicit `.max()`, every free-text field has an explicit `.max()`
 * length — "no unlimited free text anywhere" is a schema-level guarantee,
 * not a prompt-only instruction. Id fields (`relatedPostId`, `relatedIdeaId`,
 * `relatedInspirationId`, `referencedContent[].id`) are validated here only
 * for shape (non-empty string) — the *semantic* check that each actually
 * references a real Post/Idea/Inspiration/Script/Carousel present in
 * `SocialStrategistContext` happens in `semanticValidation.ts`, the same
 * two-stage split `crmAssistantModelOutputSchema`/`semanticValidation.ts`
 * already established.
 */
export const socialStrategistModelOutputSchema = z.object({
  accountObservations: observationArraySchema,
  contentOpportunities: z.array(socialStrategistContentOpportunitySchema).max(10),
  contentPillars: z.array(socialStrategistContentPillarSchema).max(6),
  nextContentRecommendations: z.array(socialStrategistNextContentRecommendationSchema).max(10),
  postingStrategyNotes: observationArraySchema,
  audienceObservations: observationArraySchema,
  referencedContent: z.array(socialStrategistReferencedContentSchema).max(15),
  conversionObservations: observationArraySchema,
  dataSufficiencyNotes: z.array(z.string().trim().min(1).max(NOTE_MAX_LENGTH)).max(8),
  confidence: z.number().min(0).max(100),
});

export type SocialStrategistModelOutputParsed = z.infer<typeof socialStrategistModelOutputSchema>;
