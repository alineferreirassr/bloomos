import type { ServiceAiKnowledgeType } from "@/core/enums/serviceAiKnowledgeType";
import type { ServiceAiKnowledgeSeverity } from "@/core/enums/serviceAiKnowledgeSeverity";

/**
 * One structured piece of operational knowledge a Service carries for Bloom
 * AI to narrate (a common mistake, a best practice, a typical delay, a
 * safety reminder, an important observation) — data the AI context builder
 * folds in as a fact, never a prompt instruction the model follows. Matches
 * docs/ai.md's "data-grounded, not speculative" guardrail exactly. See
 * docs/services.md's Operational Graph section for how the AI context
 * assembly traversal uses `severity` to avoid prompt bloat when several
 * Services are assigned to one Event.
 */
export interface ServiceAiKnowledgeItem {
  id: string;
  workspace_id: string;
  service_version_id: string;
  knowledge_type: ServiceAiKnowledgeType;
  content: string;
  severity: ServiceAiKnowledgeSeverity;
  display_order: number;
  created_at: string;
  updated_at: string;
}
