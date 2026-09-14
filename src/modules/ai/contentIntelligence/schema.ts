import { z } from "zod";
import { AI_GENERATION_SOURCE_ENTITY_TYPES } from "@/types/aiGeneration";

/**
 * SOCIAL-09C — every string field in the model's structured output must
 * pass through this: trimmed, length-bounded, and rejected outright if it
 * looks like a markup tag. This is output validation ("No HTML. No
 * executable content." — the checkpoint's own output-contract requirement),
 * not the keyword-based prompt-injection filtering SOCIAL-09B/09C both
 * explicitly rule out — that concern is about never letting *input* alter
 * trusted instructions; this is about never persisting a provider response
 * that isn't plain text, regardless of why the provider produced it.
 */
const HTML_LIKE_PATTERN = /<\/?[a-zA-Z][^>]*>/;

function plainTextField(maxLength: number) {
  return z
    .string()
    .trim()
    .min(1)
    .max(maxLength)
    .refine((value) => !HTML_LIKE_PATTERN.test(value), { message: "Must be plain text — no HTML/markup." });
}

/**
 * The AI Content Brief / Content Improvement Analysis output contract —
 * SOCIAL-09C's one authorized advisory capability. Every array is bounded
 * (mirrors `eventOperationsBriefModelOutputSchema`'s own convention) so a
 * malformed or adversarial provider response can never persist an unbounded
 * payload. `confidence` is self-reported by the use case (0–100, matching
 * `AIGeneration.confidence`'s own convention) since nothing in the runtime
 * pipeline carries a confidence value of its own.
 */
export const contentIntelligenceBriefOutputSchema = z.object({
  summary: plainTextField(1200),
  hookSuggestions: z.array(plainTextField(300)).max(10),
  ctaSuggestions: z.array(plainTextField(300)).max(10),
  audienceObservations: plainTextField(1200),
  strengths: z.array(plainTextField(300)).max(10),
  gaps: z.array(plainTextField(300)).max(10),
  recommendations: z.array(plainTextField(300)).max(10),
  confidence: z.number().int().min(0).max(100),
});

/** Validates `analyzeContentAction`'s own input — just a source reference, nothing else. Everything about the analysis itself is derived server-side from the referenced record. */
export const analyzeContentInputSchema = z.object({
  source_entity_type: z.enum(AI_GENERATION_SOURCE_ENTITY_TYPES),
  source_entity_id: z.string().trim().min(1, "A source entity id is required"),
});
