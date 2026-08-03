import { getAIContextBuilder } from "@/core/ai/context/registry";
import { applyTokenBudget, estimateTokens } from "@/core/ai/tokenBudget";
import type { TokenBudgetConfig } from "@/core/ai/tokenBudget";
import { AI_CONTEXT_SECTION_KEYS, type AIContextSectionKey } from "@/core/ai/context/types";

export interface AIContextRequest {
  workspaceId: string;
  sections: AIContextSectionKey[];
  refs: Record<string, string | undefined>;
  tokenBudget?: TokenBudgetConfig;
}

export interface AIContextAssemblyResult {
  sections: Record<string, unknown>;
  provenance: Record<string, string>;
  omittedSections: string[];
  truncated: boolean;
  estimatedTokens: number;
  generatedAt: string;
}

interface ResolvedSection {
  key: AIContextSectionKey;
  priority: number;
  data: unknown;
  source: string;
}

/**
 * Fans out to every registered builder for the requested sections, in
 * parallel, then assembles the result in a fixed, deterministic order — the
 * canonical `AI_CONTEXT_SECTION_KEYS` order, not request order, so the same
 * request always yields the same section order regardless of how a caller
 * listed `sections` — and, only when a token budget is supplied, truncates
 * via `applyTokenBudget` using each builder's own declared priority.
 */
export async function assembleAIContext(request: AIContextRequest): Promise<AIContextAssemblyResult> {
  const generatedAt = new Date().toISOString();
  const params = { workspaceId: request.workspaceId, refs: request.refs };

  const resolved = await Promise.all(
    request.sections.map(async (key): Promise<ResolvedSection | null> => {
      const builder = getAIContextBuilder(key);
      if (!builder) return null;
      const result = await builder.build(params);
      if (!result) return null;
      return { key, priority: builder.priority, data: result.data, source: result.source };
    }),
  );

  const present = resolved
    .filter((section): section is ResolvedSection => section !== null)
    .sort((a, b) => AI_CONTEXT_SECTION_KEYS.indexOf(a.key) - AI_CONTEXT_SECTION_KEYS.indexOf(b.key));

  const rawSections: Record<string, unknown> = {};
  const provenance: Record<string, string> = {};
  for (const section of present) {
    rawSections[section.key] = section.data;
    provenance[section.key] = section.source;
  }

  if (!request.tokenBudget) {
    const estimatedTokens = present.reduce((sum, section) => sum + estimateTokens(JSON.stringify(section.data ?? null)), 0);
    return { sections: rawSections, provenance, omittedSections: [], truncated: false, estimatedTokens, generatedAt };
  }

  const truncation = applyTokenBudget(rawSections, {
    ...request.tokenBudget,
    sections: present.map((section) => ({ key: section.key, priority: section.priority })),
  });

  const keptProvenance: Record<string, string> = {};
  for (const key of Object.keys(truncation.content)) keptProvenance[key] = provenance[key];

  return {
    sections: truncation.content,
    provenance: keptProvenance,
    omittedSections: truncation.omittedSections,
    truncated: truncation.truncated,
    estimatedTokens: truncation.estimatedTokens,
    generatedAt,
  };
}
