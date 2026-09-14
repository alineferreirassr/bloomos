import { z } from "zod";
import { AI_GENERATION_SOURCE_ENTITY_TYPES } from "@/types/aiGeneration";

/**
 * SOCIAL-09B — validates the shape of a create-generation input at the
 * Server Action boundary. `input`/`output` are validated only as plain JSON
 * objects (never arrays, never primitives) — their internal shape is
 * per-use-case and owned by whichever future feature-specific action calls
 * `createAIGenerationAction` (see `types/aiGeneration.ts`'s own doc comment
 * on why this is JSONB at all). `confidence`/`skill_id` are nullable,
 * matching the domain type exactly; every other field is required since
 * this action never calls a provider itself — the caller must already have
 * a completed generation result in hand.
 */
export const aiGenerationCreateSchema = z.object({
  source_entity_type: z.enum(AI_GENERATION_SOURCE_ENTITY_TYPES),
  source_entity_id: z.string().trim().min(1, "A source entity id is required"),
  use_case_id: z.string().trim().min(1, "A use case id is required"),
  skill_id: z.string().trim().min(1).nullable(),
  input: z.record(z.string(), z.unknown()),
  output: z.record(z.string(), z.unknown()),
  provider_id: z.string().trim().min(1, "A provider id is required"),
  model: z.string().trim().min(1, "A model name is required"),
  prompt_version: z.string().trim().min(1, "A prompt version is required"),
  is_mock: z.boolean(),
  latency_ms: z.number().int().nonnegative(),
  confidence: z.number().int().min(0).max(100).nullable(),
});

export const aiGenerationListFiltersSchema = z.object({
  source_entity_type: z.enum(AI_GENERATION_SOURCE_ENTITY_TYPES).optional(),
  source_entity_id: z.string().trim().min(1).optional(),
  use_case_id: z.string().trim().min(1).optional(),
  approval_status: z.enum(["proposed", "approved", "rejected"]).optional(),
  archived: z.enum(["active", "archived", "all"]).optional(),
  limit: z.number().int().positive().optional(),
});
