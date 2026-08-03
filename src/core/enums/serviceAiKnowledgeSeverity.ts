/** Lets a future AI prompt-assembly step cap how many knowledge entries it includes per brief (e.g. "high" only) rather than dumping every entry from every assigned Service into one prompt — see docs/services.md's Operational Graph section. */
export const SERVICE_AI_KNOWLEDGE_SEVERITIES = ["low", "medium", "high"] as const;

export type ServiceAiKnowledgeSeverity = (typeof SERVICE_AI_KNOWLEDGE_SEVERITIES)[number];

export const SERVICE_AI_KNOWLEDGE_SEVERITY_LABELS: Record<ServiceAiKnowledgeSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};
