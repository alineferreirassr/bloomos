import type { MediaAsset } from "@/types/mediaAsset";
import type { KnowledgeRelationship, KnowledgeNodeType } from "@/types/knowledgeGraph";
import { RELATIONSHIP_TYPE_LABELS } from "@/types/knowledgeGraph";
import type { AssetUsageContext, AssetUsageReference, AssetUsageSummary } from "@/types/digitalAssets";

/**
 * v2.0 Checkpoint 37, Step 8 — Usage Engine. Determines where an asset is
 * genuinely referenced from data that already exists — never a guess, and
 * never a new tracking mechanism. Three real signal sources:
 *
 * 1. The asset's own `owner_type`/`owner_id` (its direct polymorphic
 *    owner) — only counted when the owner type is one of this checkpoint's
 *    named usage contexts (`client`/`contract`/`invoice`/`proposal`/
 *    `document`); an asset owned by `"workspace"` (the common
 *    unfiled-library-upload case) or `"event"`/`"lead"`/`"vendor"` etc. is
 *    real ownership but outside this checkpoint's own named context
 *    vocabulary, so it deliberately produces no usage reference here.
 * 2. Real `Document.media_asset_id` back-references (a Document that
 *    attaches this exact file).
 * 3. Active Knowledge Graph edges touching the asset's own node — every
 *    edge counts as generic "knowledge_graph" usage EXCEPT `belongs_to`,
 *    which the real `uploadMediaAsset` repository action (Checkpoint 25)
 *    emits automatically for every single upload as a provenance edge to
 *    the asset's own `owner_type`/`owner_id` — the exact same fact
 *    `OWNER_TYPE_TO_USAGE_CONTEXT` above already answers. Counting it here
 *    too would mean literally every asset in the workspace looks "used"
 *    the instant it's uploaded, making "Unused Asset" (Step 10's own
 *    Health Engine issue) never fire — the opposite of what a deterministic
 *    usage signal is for. A `produces_deliverable` edge additionally counts
 *    as "execution_package" usage (the one real Execution Package → asset
 *    linkage that exists, per `docs/knowledge-graph.md`).
 *
 * "Journey"/"Dispatch"/"Timeline"/"Portfolio" are named in the spec's own
 * usage-context list but have no real linkage anywhere in this codebase to
 * check — Client Journey is a computed read model with no asset FK of its
 * own, Dispatch's only live Knowledge Graph edges point at Worker/Vehicle/
 * Equipment (never an asset), Timeline is a log of the asset's *own*
 * lifecycle rather than something that references it, and no "Portfolio"
 * concept exists in this codebase at all. These four contexts are reserved
 * vocabulary in `AssetUsageContext`, never fabricated as live references —
 * the same "disclosed, not silently faked" discipline the Knowledge Graph
 * itself holds to for its own reserved relationship types.
 */

const OWNER_TYPE_TO_USAGE_CONTEXT: Partial<Record<string, AssetUsageContext>> = {
  client: "client",
  contract: "contract",
  invoice: "invoice",
  proposal: "proposal",
  document: "document",
};

export interface DocumentBackReference {
  id: string;
  title: string;
}

export function resolveAssetUsage(asset: MediaAsset, relationships: KnowledgeRelationship[], documentsReferencingAsset: DocumentBackReference[]): AssetUsageSummary {
  const references: AssetUsageReference[] = [];

  const ownerContext = OWNER_TYPE_TO_USAGE_CONTEXT[asset.owner_type];
  if (ownerContext) {
    references.push({ context: ownerContext, nodeType: asset.owner_type, nodeId: asset.owner_id, label: `Owned by this ${ownerContext}`, href: null });
  }

  for (const doc of documentsReferencingAsset) {
    references.push({ context: "document", nodeType: "document", nodeId: doc.id, label: doc.title, href: `/documents/${doc.id}` });
  }

  const activeRelationships = relationships.filter((rel) => rel.status === "active" && rel.relationship_type !== "belongs_to");
  for (const rel of activeRelationships) {
    const isSourceAsset = rel.source_node_type === "media_asset" && rel.source_node_id === asset.id;
    const otherType: KnowledgeNodeType = isSourceAsset ? rel.target_node_type : rel.source_node_type;
    const otherId = isSourceAsset ? rel.target_node_id : rel.source_node_id;

    references.push({ context: "knowledge_graph", nodeType: otherType, nodeId: otherId, label: RELATIONSHIP_TYPE_LABELS[rel.relationship_type], href: null });

    if (rel.relationship_type === "produces_deliverable") {
      references.push({ context: "execution_package", nodeType: otherType, nodeId: otherId, label: "Execution Package deliverable", href: null });
    }
  }

  return { assetId: asset.id, references, isUnused: references.length === 0 };
}
