import type { AIGenerationSourceEntityType } from "@/types/aiGeneration";
import type { z } from "zod";
import type { contentIntelligenceBriefOutputSchema } from "@/modules/ai/contentIntelligence/schema";

/**
 * SOCIAL-09C — the exact shape `analyzeContentAction` hands to
 * `runContentIntelligenceAnalysis`, already fetched and workspace-verified.
 * `fields` holds only the non-null, non-empty text fields for this specific
 * entity (e.g. Idea's `description`/`hook`/`cta`/`audience`/`notes`,
 * Script's joined block `content`) — every value here is untrusted,
 * workspace-authored free text and must be wrapped in
 * `UntrustedSourceContent` before it reaches a prompt (see
 * `promptBuilder.ts`).
 */
export interface ContentIntelligenceSourceContent {
  sourceEntityType: AIGenerationSourceEntityType;
  sourceEntityId: string;
  title: string;
  fields: Record<string, string>;
}

export type ContentIntelligenceBriefOutput = z.infer<typeof contentIntelligenceBriefOutputSchema>;
