import { getInboundRelationships, getOutboundRelationships } from "@/core/knowledge/graphTraversalEngine";
import type { KnowledgeRelationship, KnowledgeNodeRef, OrphanedAssetFinding } from "@/types/knowledgeGraph";
import type { MediaAsset } from "@/types/mediaAsset";

/**
 * v2.0 Checkpoint 25, Step 10.5 — Orphan Detection Engine, deliberately
 * deterministic ("Do not use external AI. Keep all detection
 * deterministic." — spec). Every check here is a plain boolean condition
 * over already-fetched data; nothing is inferred, scored, or guessed.
 */

export interface DetectOrphanedAssetsInput {
  assets: MediaAsset[];
  relationships: KnowledgeRelationship[];
  /** Node keys (`${nodeType}:${nodeId}`) the caller has confirmed still exist — an asset whose own `owner_type`/`owner_id` isn't in this set is "linked to a deleted entity." The engine never fetches this itself (no data access), matching every other pure engine in this codebase. */
  existingNodeKeys: Set<string>;
}

function assetNodeRef(asset: MediaAsset): KnowledgeNodeRef {
  return { nodeType: "media_asset", nodeId: asset.id };
}

export function detectOrphanedAssets(input: DetectOrphanedAssetsInput): OrphanedAssetFinding[] {
  const findings: OrphanedAssetFinding[] = [];

  for (const asset of input.assets) {
    const node = assetNodeRef(asset);
    const inbound = getInboundRelationships(node, input.relationships);
    const outbound = getOutboundRelationships(node, input.relationships);
    const totalRelationships = inbound.length + outbound.length;

    if (totalRelationships === 0) {
      findings.push({ node, reason: "no_relationships", detail: `"${asset.original_filename}" has no recorded relationships to any other record.` });
    }

    const ownerKey = `${asset.owner_type}:${asset.owner_id}`;
    if (!input.existingNodeKeys.has(ownerKey)) {
      findings.push({ node, reason: "linked_to_deleted_entity", detail: `"${asset.original_filename}"'s owner (${ownerKey}) no longer exists.` });
    }

    if (asset.archived_at !== null && inbound.length > 0) {
      findings.push({ node, reason: "archived_but_referenced", detail: `"${asset.original_filename}" is archived but still has ${inbound.length} incoming reference${inbound.length === 1 ? "" : "s"}.` });
    }

    // A relationship recorded against an earlier version (its own `metadata.assetVersion` snapshot, taken when the edge was created) that no longer matches the asset's current version means something out there still points at a superseded version's content.
    const staleVersionRefs = inbound.filter((r) => {
      const snapshotVersion = r.metadata.assetVersion;
      return snapshotVersion !== undefined && Number(snapshotVersion) < asset.version;
    });
    if (staleVersionRefs.length > 0) {
      findings.push({
        node,
        reason: "superseded_version_still_referenced",
        detail: `${staleVersionRefs.length} reference${staleVersionRefs.length === 1 ? "" : "s"} to "${asset.original_filename}" still point${staleVersionRefs.length === 1 ? "s" : ""} at a version older than the current v${asset.version}.`,
      });
    }
  }

  return findings;
}

/** Duplicate relationship detection — two active edges with the same source, target, and type. The store's own `createRelationship` already prevents new duplicates from forming (see `knowledgeGraphStore.ts`); this is a read-only audit over what already exists, e.g. rows created before that guard, or via direct store manipulation in a migration. */
export function findDuplicateRelationships(relationships: KnowledgeRelationship[]): KnowledgeRelationship[][] {
  const groups = new Map<string, KnowledgeRelationship[]>();
  for (const r of relationships.filter((r) => r.status === "active")) {
    const key = `${r.source_node_type}:${r.source_node_id}>${r.relationship_type}>${r.target_node_type}:${r.target_node_id}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(r);
    groups.set(key, bucket);
  }
  return Array.from(groups.values()).filter((bucket) => bucket.length > 1);
}
