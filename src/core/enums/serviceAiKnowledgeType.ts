/**
 * The category of one structured operational-knowledge entry a ServiceVersion
 * carries for Bloom AI to narrate — data, never a prompt instruction. See
 * docs/ai.md's guardrail that Bloom AI is data-grounded, never speculative;
 * these entries are exactly the kind of deterministic fact the AI context
 * builder is allowed to fold in and narrate, the same way it already
 * narrates Health Score factors and detected risks without inventing them.
 */
export const SERVICE_AI_KNOWLEDGE_TYPES = [
  "common_mistake",
  "best_practice",
  "typical_delay",
  "safety_reminder",
  "important_observation",
] as const;

export type ServiceAiKnowledgeType = (typeof SERVICE_AI_KNOWLEDGE_TYPES)[number];

export const SERVICE_AI_KNOWLEDGE_TYPE_LABELS: Record<ServiceAiKnowledgeType, string> = {
  common_mistake: "Common Mistake",
  best_practice: "Best Practice",
  typical_delay: "Typical Delay",
  safety_reminder: "Safety Reminder",
  important_observation: "Important Observation",
};
