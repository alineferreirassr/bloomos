export interface TokenBudgetSectionConfig {
  key: string;
  /** Lower number = kept first when the budget is tight. Ties broken by input order. */
  priority: number;
}

export interface TokenBudgetConfig {
  maxInputTokens: number;
  reservedOutputTokens: number;
  sections?: TokenBudgetSectionConfig[];
}

export interface TruncationResult {
  content: Record<string, unknown>;
  truncated: boolean;
  omittedSections: string[];
  estimatedTokens: number;
}

/**
 * A deterministic, no-external-tokenizer estimate — roughly 4 characters
 * per token, the same rule-of-thumb every major provider's own docs quote
 * for English text. Good enough to budget against without requiring a real
 * tokenizer dependency for a provider that doesn't expose one; if a
 * provider ever does expose exact counts, swap this call for that, nothing
 * else needs to change (see `AIRuntimeExecutionMetadata.tokenUsage`, which
 * carries the *real* count once a provider reports one).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function estimateSectionTokens(value: unknown): number {
  try {
    return estimateTokens(JSON.stringify(value ?? null));
  } catch {
    return 0;
  }
}

/**
 * Section-granularity truncation, not per-field — simpler to reason about
 * and to test, and still satisfies "deterministic truncation, priority
 * ordering, warnings when relevant context is omitted." Sections are kept
 * whole or dropped whole; a dropped section is named in `omittedSections`
 * so a caller can log/surface exactly what was left out, never silently.
 */
export function applyTokenBudget(sections: Record<string, unknown>, config: TokenBudgetConfig): TruncationResult {
  const budget = Math.max(config.maxInputTokens - config.reservedOutputTokens, 0);
  const keys = Object.keys(sections);
  const priorityOf = (key: string) => config.sections?.find((section) => section.key === key)?.priority ?? keys.indexOf(key);
  const orderedKeys = [...keys].sort((a, b) => priorityOf(a) - priorityOf(b));

  const content: Record<string, unknown> = {};
  const omittedSections: string[] = [];
  let usedTokens = 0;

  for (const key of orderedKeys) {
    const sectionTokens = estimateSectionTokens(sections[key]);
    if (usedTokens + sectionTokens > budget) {
      omittedSections.push(key);
      continue;
    }
    content[key] = sections[key];
    usedTokens += sectionTokens;
  }

  return { content, truncated: omittedSections.length > 0, omittedSections, estimatedTokens: usedTokens };
}
