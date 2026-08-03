import { mockKnowledgeGraphRepository } from "@/lib/data/core/knowledge/knowledgeGraphStore";

export type { KnowledgeRelationship, KnowledgeNodeRef, KnowledgeNodeType, RelationshipType, RelationshipStatus, RelationshipSource, RelationshipSemantics } from "@/types/knowledgeGraph";
export type { CreateRelationshipInput } from "@/lib/data/core/knowledge/knowledgeGraphStore";

/** Mock-only this phase — same rationale as `core/comments`/`core/tags`; no Supabase table exists yet for the Knowledge Graph. */
export function getCoreKnowledgeGraphService() {
  return mockKnowledgeGraphRepository;
}
