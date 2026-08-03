import type { KnowledgeRelationship, KnowledgeNodeRef, KnowledgeNodeType, RelationshipType, RelationshipSource, RelationshipSemantics } from "@/types/knowledgeGraph";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 25, Step 10.5 — the Knowledge Graph's own persistence.
 * One flat, workspace-scoped array of edges — same `let` array + `resetXStore()`
 * convention every other mock store in this codebase uses. This is the
 * *only* relationship store this checkpoint introduces; DAM's own "Entity
 * Relationships" (Step 10) reads and writes through this exact store rather
 * than a second, parallel one — see `docs/knowledge-graph.md`.
 */
let relationships: KnowledgeRelationship[] = [];

/** Test-only: restore the store to empty between test cases. */
export function resetKnowledgeGraphStore(): void {
  relationships = [];
}

export interface CreateRelationshipInput {
  sourceNodeType: KnowledgeNodeType;
  sourceNodeId: string;
  targetNodeType: KnowledgeNodeType;
  targetNodeId: string;
  relationshipType: RelationshipType;
  source: RelationshipSource;
  confidence?: number;
  notes?: string | null;
  metadata?: Record<string, string>;
  startDate?: string | null;
  endDate?: string | null;
  /** Step 10.6 — Semantic Relationship Engine. Omitted/`null` is the common case for purely structural edges. */
  semantics?: RelationshipSemantics | null;
}

function nodeRefEquals(a: KnowledgeNodeRef, b: KnowledgeNodeRef): boolean {
  return a.nodeType === b.nodeType && a.nodeId === b.nodeId;
}

async function createRelationship(workspaceId: string, createdBy: string, input: CreateRelationshipInput): Promise<DataResult<KnowledgeRelationship>> {
  if (input.sourceNodeType === input.targetNodeType && input.sourceNodeId === input.targetNodeId) {
    return fail("Please fix the highlighted fields.", { target: "A node cannot have a relationship with itself." });
  }
  // Exact duplicate (same source, target, type, still active) is a no-op that returns the existing edge — "Duplicate relationship" detection (spec's Duplicate & Reuse Intelligence) relies on this never silently multiplying.
  const existing = relationships.find(
    (r) =>
      r.workspace_id === workspaceId &&
      r.status === "active" &&
      r.source_node_type === input.sourceNodeType &&
      r.source_node_id === input.sourceNodeId &&
      r.target_node_type === input.targetNodeType &&
      r.target_node_id === input.targetNodeId &&
      r.relationship_type === input.relationshipType,
  );
  if (existing) return ok(existing);

  const timestamp = nowIso();
  const relationship: KnowledgeRelationship = {
    id: generateId("rel"),
    workspace_id: workspaceId,
    source_node_type: input.sourceNodeType,
    source_node_id: input.sourceNodeId,
    target_node_type: input.targetNodeType,
    target_node_id: input.targetNodeId,
    relationship_type: input.relationshipType,
    created_by: createdBy,
    created_at: timestamp,
    updated_at: timestamp,
    // A future-AI-suggestion source is never active on creation — "must always be reviewed and approved before becoming permanent" (spec).
    status: input.source === "future_ai_suggestion" ? "rejected" : "active",
    confidence: input.confidence ?? 100,
    source: input.source,
    notes: input.notes ?? null,
    metadata: input.metadata ?? {},
    start_date: input.startDate ?? null,
    end_date: input.endDate ?? null,
    semantics: input.semantics ?? null,
  };
  relationships = [...relationships, relationship];
  return ok(relationship);
}

/** Step 10.6 — assigns or replaces a relationship's business meaning. Never invoked automatically; always an explicit user/module action. Passing `null` clears semantics back to "no meaning assigned yet." */
async function setRelationshipSemantics(id: string, workspaceId: string, semantics: RelationshipSemantics | null): Promise<DataResult<KnowledgeRelationship>> {
  const existing = relationships.find((r) => r.id === id && r.workspace_id === workspaceId);
  if (!existing) return fail("Relationship not found.");
  const updated: KnowledgeRelationship = { ...existing, semantics, updated_at: nowIso() };
  relationships = relationships.map((r) => (r.id === id ? updated : r));
  return ok(updated);
}

async function removeRelationship(id: string, workspaceId: string): Promise<DataResult<KnowledgeRelationship>> {
  const existing = relationships.find((r) => r.id === id && r.workspace_id === workspaceId);
  if (!existing) return fail("Relationship not found.");
  const updated: KnowledgeRelationship = { ...existing, status: "archived", updated_at: nowIso() };
  relationships = relationships.map((r) => (r.id === id ? updated : r));
  return ok(updated);
}

async function approveRelationship(id: string, workspaceId: string): Promise<DataResult<KnowledgeRelationship>> {
  const existing = relationships.find((r) => r.id === id && r.workspace_id === workspaceId);
  if (!existing) return fail("Relationship not found.");
  const updated: KnowledgeRelationship = { ...existing, status: "active", confidence: 100, updated_at: nowIso() };
  relationships = relationships.map((r) => (r.id === id ? updated : r));
  return ok(updated);
}

async function rejectRelationship(id: string, workspaceId: string): Promise<DataResult<KnowledgeRelationship>> {
  const existing = relationships.find((r) => r.id === id && r.workspace_id === workspaceId);
  if (!existing) return fail("Relationship not found.");
  const updated: KnowledgeRelationship = { ...existing, status: "rejected", updated_at: nowIso() };
  relationships = relationships.map((r) => (r.id === id ? updated : r));
  return ok(updated);
}

/** Strictly workspace-scoped — never returns a relationship from another workspace, the graph's own "Strict Workspace Isolation" requirement enforced at the one read path every other query composes from. */
async function listRelationshipsForWorkspace(workspaceId: string, includeInactive = false): Promise<KnowledgeRelationship[]> {
  return relationships.filter((r) => r.workspace_id === workspaceId && (includeInactive || r.status === "active"));
}

async function getOutboundRelationships(workspaceId: string, node: KnowledgeNodeRef, includeInactive = false): Promise<KnowledgeRelationship[]> {
  const all = await listRelationshipsForWorkspace(workspaceId, includeInactive);
  return all.filter((r) => r.source_node_type === node.nodeType && r.source_node_id === node.nodeId);
}

async function getInboundRelationships(workspaceId: string, node: KnowledgeNodeRef, includeInactive = false): Promise<KnowledgeRelationship[]> {
  const all = await listRelationshipsForWorkspace(workspaceId, includeInactive);
  return all.filter((r) => r.target_node_type === node.nodeType && r.target_node_id === node.nodeId);
}

export const mockKnowledgeGraphRepository = {
  createRelationship,
  removeRelationship,
  approveRelationship,
  rejectRelationship,
  setRelationshipSemantics,
  listRelationshipsForWorkspace,
  getOutboundRelationships,
  getInboundRelationships,
};

export { nodeRefEquals };
