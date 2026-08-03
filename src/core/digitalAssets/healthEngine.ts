import type { MediaAsset } from "@/types/mediaAsset";
import type { AssetVisibility, AssetHealth, AssetHealthBand, AssetHealthIssue, AssetHealthIssueType, PlatformHealthSummary } from "@/types/digitalAssets";
import type { PreviewType } from "@/types/digitalAssets";
import { ASSET_HEALTH_ISSUE_TYPES } from "@/types/digitalAssets";

/**
 * v2.0 Checkpoint 37, Step 10 — Health Engine. Every issue type is a
 * deterministic check over real fields — never inferred, never AI-scored.
 * `duplicate_placeholder` is a real checksum comparison (asset bytes are
 * genuinely identical) even though its name keeps the spec's own wording —
 * "placeholder" describes that no dedupe/merge *resolution* workflow
 * exists yet, not that detection is fake.
 */

const ISSUE_WEIGHTS: Record<AssetHealthIssueType, number> = {
  unused_asset: 15,
  missing_metadata: 10,
  no_folder: 5,
  no_tags: 5,
  old_version: 10,
  no_preview: 10,
  permission_problem: 20,
  duplicate_placeholder: 15,
};

/** An asset whose file hasn't been touched in over a year is flagged "Old Version" — a deliberately generous threshold so a genuinely stable, still-relevant brand asset isn't flagged every quarter. */
const OLD_VERSION_THRESHOLD_MS = 365 * 24 * 60 * 60 * 1000;

export interface AssetHealthContext {
  isUnused: boolean;
  metadataComplete: boolean;
  previewType: PreviewType;
  visibility: AssetVisibility;
  /** Checksums of every other active asset in the workspace, for duplicate detection. */
  otherActiveChecksums: string[];
  now?: Date;
}

export function evaluateAssetHealth(asset: MediaAsset, context: AssetHealthContext): AssetHealth {
  const now = context.now ?? new Date();
  const issues: AssetHealthIssue[] = [];

  if (context.isUnused) {
    issues.push({ type: "unused_asset", detail: "This file isn't referenced by any Proposal, Contract, Invoice, Document, or Knowledge Graph relationship." });
  }
  if (!context.metadataComplete) {
    issues.push({ type: "missing_metadata", detail: "Author or dimensions are missing." });
  }
  if (asset.folder_id === null) {
    issues.push({ type: "no_folder", detail: "This file isn't filed in a folder." });
  }
  if (asset.tags.length === 0) {
    issues.push({ type: "no_tags", detail: "This file has no tags." });
  }
  if (now.getTime() - new Date(asset.updated_at).getTime() > OLD_VERSION_THRESHOLD_MS) {
    issues.push({ type: "old_version", detail: "This file hasn't been updated in over a year." });
  }
  if (context.previewType === "unknown") {
    issues.push({ type: "no_preview", detail: "BloomOS doesn't know how to preview this file type." });
  }
  if (asset.owner_type === "client" && context.visibility !== "client" && context.visibility !== "public_placeholder") {
    issues.push({ type: "permission_problem", detail: "This file belongs to a client but isn't visible to clients." });
  }
  if (context.otherActiveChecksums.includes(asset.checksum)) {
    issues.push({ type: "duplicate_placeholder", detail: "Another file in this workspace has identical contents." });
  }

  const score = Math.max(0, 100 - issues.reduce((total, issue) => total + ISSUE_WEIGHTS[issue.type], 0));

  return { assetId: asset.id, score, band: bandForScore(score), issues, evaluatedAt: now.toISOString() };
}

export function bandForScore(score: number): AssetHealthBand {
  if (score >= 90) return "excellent";
  if (score >= 70) return "good";
  if (score >= 40) return "attention";
  return "critical";
}

export function summarizePlatformHealth(workspaceId: string, healthResults: AssetHealth[], now: Date = new Date()): PlatformHealthSummary {
  const issueBreakdown = Object.fromEntries(ASSET_HEALTH_ISSUE_TYPES.map((type) => [type, 0])) as Record<AssetHealthIssueType, number>;
  let scoreTotal = 0;
  let assetsWithIssues = 0;

  for (const health of healthResults) {
    scoreTotal += health.score;
    if (health.issues.length > 0) assetsWithIssues += 1;
    for (const issue of health.issues) issueBreakdown[issue.type] += 1;
  }

  const averageScore = healthResults.length === 0 ? 100 : Math.round(scoreTotal / healthResults.length);

  return {
    workspaceId,
    averageScore,
    band: bandForScore(averageScore),
    assetsEvaluated: healthResults.length,
    assetsWithIssues,
    issueBreakdown,
    evaluatedAt: now.toISOString(),
  };
}
