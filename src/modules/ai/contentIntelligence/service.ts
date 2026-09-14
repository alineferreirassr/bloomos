import { randomUUID } from "node:crypto";
import type { AIProvider } from "@/core/ai/types";
import { executeAIRequest } from "@/core/ai/runtime/runtime";
import { routeAIUseCase } from "@/core/ai/prompts/router";
import { parseStructuredOutput } from "@/core/ai/structuredOutput";
import { createAIGeneration } from "@/lib/data";
import { registerContentIntelligenceUseCase } from "@/modules/ai/contentIntelligence/registerContentIntelligenceUseCase";
import { CONTENT_INTELLIGENCE_USE_CASE_ID } from "@/modules/ai/contentIntelligence/promptBuilder";
import { createContentIntelligenceMockProvider } from "@/modules/ai/contentIntelligence/mockProvider";
import type { ContentIntelligenceSourceContent, ContentIntelligenceBriefOutput } from "@/modules/ai/contentIntelligence/types";
import type { AIGeneration } from "@/types/aiGeneration";
import type { DataResult } from "@/lib/data/result";

export interface RunContentIntelligenceAnalysisParams {
  workspaceId: string;
  createdBy: string | null;
  source: ContentIntelligenceSourceContent;
  /** Test-only seam — production callers (`analyzeContentAction.ts`) never pass this, so every real invocation always runs through `createContentIntelligenceMockProvider()`. Lets tests exercise "malformed provider output" and "provider failure" without needing to fake a full session/ownership chain. */
  provider?: AIProvider;
}

/**
 * SOCIAL-09C — the AI orchestration pipeline for one Content Brief:
 * Prompt Registry → prompt boundary → `executeAIRequest` (the platform's
 * single execution seam, reused unchanged) → structured-output validation
 * → persistence via the SOCIAL-09B `ai_generations` foundation. Never calls
 * a provider directly (`provider.complete()`) — always through
 * `executeAIRequest`, matching every other AI use case in this codebase.
 * Assumes the caller has already re-verified the source entity's workspace
 * ownership (see `analyzeContentAction.ts`'s own `loadOwnedSourceContent`)
 * — this function has no independent way to do so, the same trust boundary
 * `createScriptBlock`/every other repository-adjacent function in this
 * codebase already relies on.
 */
export async function runContentIntelligenceAnalysis(params: RunContentIntelligenceAnalysisParams): Promise<DataResult<AIGeneration>> {
  registerContentIntelligenceUseCase();
  const routed = routeAIUseCase(CONTENT_INTELLIGENCE_USE_CASE_ID);
  if (!routed.success) {
    return { success: false, error: "Bloom AI couldn't process this request right now." };
  }

  const prompt = routed.useCase.buildMessages(params.source, undefined);
  const provider = params.provider ?? createContentIntelligenceMockProvider();

  const now = new Date().toISOString();
  const conversation = {
    id: randomUUID(),
    workspaceId: params.workspaceId,
    context: { workspaceId: params.workspaceId, facts: { contentIntelligence: params.source } },
    messages: prompt,
    createdAt: now,
    updatedAt: now,
  };

  const runtimeResult = await executeAIRequest({
    provider,
    completionRequest: { conversation, prompt: prompt[prompt.length - 1] },
    useCaseId: CONTENT_INTELLIGENCE_USE_CASE_ID,
  });
  if (!runtimeResult.success) {
    return { success: false, error: "Bloom AI couldn't complete this request right now." };
  }

  const parsed = parseStructuredOutput(runtimeResult.completion.content, routed.useCase.outputSchema);
  if (!parsed.success) {
    return { success: false, error: "Bloom AI's response could not be used." };
  }

  const output = parsed.data as ContentIntelligenceBriefOutput;

  return createAIGeneration({
    workspaceId: params.workspaceId,
    createdBy: params.createdBy,
    sourceEntityType: params.source.sourceEntityType,
    sourceEntityId: params.source.sourceEntityId,
    useCaseId: CONTENT_INTELLIGENCE_USE_CASE_ID,
    skillId: null,
    input: { title: params.source.title, fields: params.source.fields },
    output: output as unknown as Record<string, unknown>,
    providerId: provider.name,
    model: runtimeResult.completion.model,
    promptVersion: routed.useCase.promptVersion,
    // Always true — no live AI provider exists anywhere in BloomOS today
    // (SOCIAL-09A). The injectable `provider` above exists purely for
    // testing this pipeline's failure paths, never to simulate a real one.
    isMock: true,
    latencyMs: runtimeResult.metadata.latencyMs,
    confidence: output.confidence,
  });
}
