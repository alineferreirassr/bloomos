import type { KnowledgeRelationship, KnowledgeNodeRef, TraversalHop, TraversalPath, RelationshipCounts, TraversalDirection } from "@/types/knowledgeGraph";

/**
 * v2.0 Checkpoint 25, Step 10.5/15 — Graph Traversal Engine. Every function
 * is pure over an already-fetched, already-workspace-scoped
 * `KnowledgeRelationship[]` — the module layer fetches
 * `listRelationshipsForWorkspace()` once and hands the array in here,
 * exactly the "engine never fetches, module layer aggregates" discipline
 * every other engine in this codebase follows. Workspace isolation is
 * therefore structural: a relationship from another workspace is never in
 * the array to begin with, not filtered out after the fact.
 *
 * Step 15 performance pass: `multiHop`/`shortestPath` used to call a
 * linear-scan `edgesTouching` once per node visited — O(hops × edges).
 * Both now build one adjacency index up front and walk it — O(edges +
 * hops). The index itself is memoized per relationship-array reference
 * (`getAdjacencyIndex`, a `WeakMap` cache): the store never mutates an
 * array in place (every mutation reassigns a new one, per this codebase's
 * own "immutable reassignment" convention), so the same array reference
 * reappearing across calls within one request is a real cache hit, and a
 * stale array is simply never looked up again — no invalidation logic
 * needed.
 */

const DEFAULT_MAX_DEPTH = 5;

function nodeKey(node: KnowledgeNodeRef): string {
  return `${node.nodeType}:${node.nodeId}`;
}

interface AdjacencyEdge {
  relationship: KnowledgeRelationship;
  other: KnowledgeNodeRef;
  direction: "outbound" | "inbound";
}

interface AdjacencyIndex {
  outbound: Map<string, AdjacencyEdge[]>;
  inbound: Map<string, AdjacencyEdge[]>;
}

const adjacencyIndexCache = new WeakMap<KnowledgeRelationship[], AdjacencyIndex>();

function buildAdjacencyIndex(relationships: KnowledgeRelationship[]): AdjacencyIndex {
  const outbound = new Map<string, AdjacencyEdge[]>();
  const inbound = new Map<string, AdjacencyEdge[]>();

  for (const r of relationships) {
    const sourceKey = nodeKey({ nodeType: r.source_node_type, nodeId: r.source_node_id });
    const targetKey = nodeKey({ nodeType: r.target_node_type, nodeId: r.target_node_id });

    const outEdge: AdjacencyEdge = { relationship: r, other: { nodeType: r.target_node_type, nodeId: r.target_node_id }, direction: "outbound" };
    const outBucket = outbound.get(sourceKey) ?? [];
    outBucket.push(outEdge);
    outbound.set(sourceKey, outBucket);

    const inEdge: AdjacencyEdge = { relationship: r, other: { nodeType: r.source_node_type, nodeId: r.source_node_id }, direction: "inbound" };
    const inBucket = inbound.get(targetKey) ?? [];
    inBucket.push(inEdge);
    inbound.set(targetKey, inBucket);
  }

  return { outbound, inbound };
}

/** Memoized per relationship-array identity — see the file-level doc comment. */
function getAdjacencyIndex(relationships: KnowledgeRelationship[]): AdjacencyIndex {
  const cached = adjacencyIndexCache.get(relationships);
  if (cached) return cached;
  const index = buildAdjacencyIndex(relationships);
  adjacencyIndexCache.set(relationships, index);
  return index;
}

function edgesTouching(node: KnowledgeNodeRef, relationships: KnowledgeRelationship[], direction: TraversalDirection): AdjacencyEdge[] {
  const index = getAdjacencyIndex(relationships);
  const key = nodeKey(node);
  const results: AdjacencyEdge[] = [];
  if (direction === "outbound" || direction === "both") results.push(...(index.outbound.get(key) ?? []));
  if (direction === "inbound" || direction === "both") results.push(...(index.inbound.get(key) ?? []));
  return results;
}

export function getOutboundRelationships(node: KnowledgeNodeRef, relationships: KnowledgeRelationship[]): KnowledgeRelationship[] {
  return (getAdjacencyIndex(relationships).outbound.get(nodeKey(node)) ?? []).map((e) => e.relationship);
}

export function getInboundRelationships(node: KnowledgeNodeRef, relationships: KnowledgeRelationship[]): KnowledgeRelationship[] {
  return (getAdjacencyIndex(relationships).inbound.get(nodeKey(node)) ?? []).map((e) => e.relationship);
}

export function getRelationshipCounts(node: KnowledgeNodeRef, relationships: KnowledgeRelationship[]): RelationshipCounts {
  const inbound = getInboundRelationships(node, relationships).length;
  const outbound = getOutboundRelationships(node, relationships).length;
  return { inbound, outbound, total: inbound + outbound };
}

/** One-Hop Relationships — every node directly connected to `node`, in either direction. */
export function oneHop(node: KnowledgeNodeRef, relationships: KnowledgeRelationship[], direction: TraversalDirection = "both"): TraversalHop[] {
  return edgesTouching(node, relationships, direction).map((e) => ({ node: e.other, relationship: e.relationship, direction: e.direction, depth: 1 }));
}

/**
 * Multi-Hop Relationships — breadth-first from `node` out to `maxDepth`
 * hops. Circular Reference Protection: a `visited` set keyed by node
 * identity means a cycle in the graph (A→B→A) is walked at most once per
 * node, never infinitely. Maximum Traversal Depth is a hard cap — this
 * function will never look further than `maxDepth` hops regardless of how
 * large the relationship array is.
 */
export function multiHop(node: KnowledgeNodeRef, relationships: KnowledgeRelationship[], maxDepth: number = DEFAULT_MAX_DEPTH, direction: TraversalDirection = "both"): TraversalHop[] {
  const visited = new Set<string>([nodeKey(node)]);
  const results: TraversalHop[] = [];
  let frontier: KnowledgeNodeRef[] = [node];

  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth += 1) {
    const nextFrontier: KnowledgeNodeRef[] = [];
    for (const current of frontier) {
      for (const edge of edgesTouching(current, relationships, direction)) {
        const key = nodeKey(edge.other);
        if (visited.has(key)) continue;
        visited.add(key);
        results.push({ node: edge.other, relationship: edge.relationship, direction: edge.direction, depth });
        nextFrontier.push(edge.other);
      }
    }
    frontier = nextFrontier;
  }
  return results;
}

/**
 * Shortest Relationship Path — breadth-first search between two nodes,
 * returning the first (shortest) path found, or `null` if they're not
 * connected within `maxDepth` hops. BFS guarantees shortest-by-hop-count
 * since every edge has equal weight.
 */
export function shortestPath(from: KnowledgeNodeRef, to: KnowledgeNodeRef, relationships: KnowledgeRelationship[], maxDepth: number = DEFAULT_MAX_DEPTH): TraversalPath | null {
  if (nodeKey(from) === nodeKey(to)) return { nodes: [from], relationships: [] };

  const visited = new Set<string>([nodeKey(from)]);
  const cameFrom = new Map<string, { fromNode: KnowledgeNodeRef; relationship: KnowledgeRelationship }>();
  let frontier: KnowledgeNodeRef[] = [from];

  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth += 1) {
    const nextFrontier: KnowledgeNodeRef[] = [];
    for (const current of frontier) {
      for (const edge of edgesTouching(current, relationships, "both")) {
        const key = nodeKey(edge.other);
        if (visited.has(key)) continue;
        visited.add(key);
        cameFrom.set(key, { fromNode: current, relationship: edge.relationship });
        if (key === nodeKey(to)) {
          // Reconstruct the path by walking `cameFrom` backwards from `to`.
          const pathNodes: KnowledgeNodeRef[] = [to];
          const pathRelationships: KnowledgeRelationship[] = [];
          let cursor = key;
          while (cameFrom.has(cursor)) {
            const step = cameFrom.get(cursor) as { fromNode: KnowledgeNodeRef; relationship: KnowledgeRelationship };
            pathNodes.unshift(step.fromNode);
            pathRelationships.unshift(step.relationship);
            cursor = nodeKey(step.fromNode);
          }
          return { nodes: pathNodes, relationships: pathRelationships };
        }
        nextFrontier.push(edge.other);
      }
    }
    frontier = nextFrontier;
  }
  return null;
}

/** Related Node Discovery — every distinct node reachable within `maxDepth`, deduplicated, nearest-first. A thin convenience wrapper over `multiHop` for callers that just want "what's connected," not the hop-by-hop path. */
export function discoverRelatedNodes(node: KnowledgeNodeRef, relationships: KnowledgeRelationship[], maxDepth: number = DEFAULT_MAX_DEPTH): KnowledgeNodeRef[] {
  return multiHop(node, relationships, maxDepth).map((hop) => hop.node);
}
