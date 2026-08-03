/**
 * What a provider can do — a use case declares which of these it needs
 * (`AIUseCaseDefinition.requiredCapabilities`), and provider selection
 * (`providerRegistry.ts`) only offers a candidate that has all of them.
 * Kept as a flat, curated list rather than a bitmask/hierarchy — matching
 * this codebase's usual "small closed set over a clever structure" bias.
 */
export const AI_CAPABILITIES = [
  "text_generation",
  "structured_output",
  "embeddings",
  "tool_calling",
  "vision",
  "long_context",
] as const;

export type AICapability = (typeof AI_CAPABILITIES)[number];
