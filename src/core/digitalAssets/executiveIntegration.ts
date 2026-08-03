import type { OperationalRecommendation } from "@/types/businessHealth";
import type { AssetHealth, PlatformHealthSummary } from "@/types/digitalAssets";
import type { MediaAsset } from "@/types/mediaAsset";

/**
 * v2.0 Checkpoint 37, Step 14 — Executive Decisions integration. One more
 * `recommendationSources` entry (`modules/executiveDecisions/executiveDecisionsActions.ts`),
 * translating the real Health Engine results this checkpoint already
 * computes into `OperationalRecommendation`s — never a second decision
 * engine, never a fabricated finding. Every recommendation traces back to a
 * real `AssetHealth`/`PlatformHealthSummary` issue, not a guess.
 */
export function digitalAssetsRecommendationsForExecutiveDecisions(healthResults: AssetHealth[], assets: MediaAsset[], platformSummary: PlatformHealthSummary): OperationalRecommendation[] {
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const recommendations: OperationalRecommendation[] = [];

  for (const health of healthResults) {
    const asset = assetById.get(health.assetId);
    if (!asset) continue;

    for (const issue of health.issues) {
      if (issue.type === "unused_asset") {
        recommendations.push({ ruleId: "dam_unused_asset", message: `"${asset.original_filename}" isn't referenced anywhere and may be safe to archive.`, severity: "info", node: { nodeType: "media_asset", nodeId: asset.id } });
      }
      if (issue.type === "missing_metadata") {
        recommendations.push({ ruleId: "dam_missing_metadata", message: `"${asset.original_filename}" is missing metadata (author or dimensions).`, severity: "info", node: { nodeType: "media_asset", nodeId: asset.id } });
      }
      if (issue.type === "permission_problem") {
        recommendations.push({ ruleId: "dam_permission_problem", message: `"${asset.original_filename}" belongs to a client but isn't visible to them.`, severity: "warning", node: { nodeType: "media_asset", nodeId: asset.id } });
      }
      if (issue.type === "no_preview") {
        recommendations.push({ ruleId: "dam_no_preview", message: `"${asset.original_filename}" is a file type BloomOS can't preview.`, severity: "info", node: { nodeType: "media_asset", nodeId: asset.id } });
      }
    }
  }

  // "Large Storage Growth" — a workspace-level signal, not per-asset. Deterministic threshold: more than 5 GB of stored assets is flagged for review, the same "generous, non-noisy default" discipline the Health Engine's own Old Version threshold uses.
  const LARGE_STORAGE_THRESHOLD_BYTES = 5 * 1024 * 1024 * 1024;
  const totalStorage = assets.filter((asset) => !asset.archived_at).reduce((sum, asset) => sum + asset.file_size, 0);
  if (totalStorage > LARGE_STORAGE_THRESHOLD_BYTES) {
    recommendations.push({ ruleId: "dam_large_storage_growth", message: `The Asset Library is now storing over ${(totalStorage / (1024 * 1024 * 1024)).toFixed(1)} GB of files.`, severity: "warning", node: { nodeType: "workspace", nodeId: platformSummary.workspaceId } });
  }

  // "Folders Needing Organization" — a workspace-level signal derived from how many assets have no_folder.
  if (platformSummary.issueBreakdown.no_folder >= 10) {
    recommendations.push({ ruleId: "dam_folders_needing_organization", message: `${platformSummary.issueBreakdown.no_folder} files aren't filed in any folder.`, severity: "info", node: { nodeType: "workspace", nodeId: platformSummary.workspaceId } });
  }

  return recommendations;
}
