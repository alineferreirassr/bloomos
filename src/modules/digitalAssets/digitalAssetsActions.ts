"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { nowIso, generateId } from "@/lib/data/utils";
import {
  getMediaAssetById,
  listMediaAssetsForWorkspace,
  replaceMediaAssetVersion,
  downloadMediaAsset,
  setMediaAssetStatus,
  getMediaFolders,
  createMediaFolder,
  moveMediaFolder,
  archiveMediaFolder,
  getMediaCollections,
  getClients,
  getDocuments,
} from "@/lib/data";
import { getCoreKnowledgeGraphService } from "@/core/knowledge";
import { getCoreCommentsService } from "@/core/comments";
import type { CreateCommentInput, Comment } from "@/core/comments";
import type { MediaAsset } from "@/types/mediaAsset";
import type { MediaFolder } from "@/types/mediaFolder";
import type { MediaFolderInput, ReplaceMediaAssetVersionInput } from "@/lib/data/media/repository";
import type { MediaAssetStatus } from "@/core/enums/mediaAssetStatus";
import type { DataResult } from "@/lib/data/result";
import { ok, fail } from "@/lib/data/result";
import type { OperationalRecommendation } from "@/types/businessHealth";

import { canDeleteFolder, buildFolderTree, type FolderTreeNode } from "@/core/digitalAssets/folderEngine";
import { buildOutgoingVersion, fullVersionHistory, compareVersionMetadata, restoreVersionPlaceholder, type MetadataFieldDiff, type RestorePlaceholderResult } from "@/core/digitalAssets/versionEngine";
import { searchAssets } from "@/core/digitalAssets/searchEngine";
import { buildAssetPreview, resolvePreviewType } from "@/core/digitalAssets/previewEngine";
import { summarizeAssetMetadata, type AssetMetadataSummary } from "@/core/digitalAssets/metadataEngine";
import { resolveAssetUsage } from "@/core/digitalAssets/usageEngine";
import { evaluateAssetPermission, resolveAssetVisibility, type AssetPermissionViewer } from "@/core/digitalAssets/permissionEngine";
import { evaluateAssetHealth, summarizePlatformHealth } from "@/core/digitalAssets/healthEngine";
import { buildAssetAnalytics } from "@/core/digitalAssets/analyticsEngine";
import { digitalAssetsRecommendationsForExecutiveDecisions as buildExecutiveRecommendations } from "@/core/digitalAssets/executiveIntegration";

import { readAssetVersions, writeAssetVersions } from "@/lib/data/mock/assetVersionsStore";
import { readAssetFavorites, writeAssetFavorites } from "@/lib/data/mock/assetFavoritesStore";
import { readAssetReviews, writeAssetReviews } from "@/lib/data/mock/assetReviewsStore";
import { readAssetShares, writeAssetShares } from "@/lib/data/mock/assetSharesStore";
import { readAssetDownloads, writeAssetDownloads } from "@/lib/data/mock/assetDownloadsStore";
import { readAssetViews, writeAssetViews } from "@/lib/data/mock/assetViewsStore";
import { readAssetVisibilityOverrides, writeAssetVisibilityOverrides } from "@/lib/data/mock/assetVisibilityStore";

import type {
  AssetVersion,
  AssetSearchFilters,
  AssetSearchResult,
  AssetPreview,
  AssetPermission,
  AssetHealth,
  PlatformHealthSummary,
  AssetAnalytics,
  AssetUsageSummary,
  AssetFavorite,
  AssetReview,
  AssetReviewDecision,
  AssetShare,
  AssetShareVisibility,
  AssetVisibility,
} from "@/types/digitalAssets";

/**
 * v2.0 Checkpoint 37, Step 15 — Digital Asset Management Platform module
 * layer. Every mutation composes the real `MediaAsset`/`MediaFolder`/
 * `MediaCollection` repository (Checkpoint 25) plus this checkpoint's own
 * engines — never a parallel mutation path. Authentication follows the
 * same `session.kind !== "active"` gate every other module action layer
 * uses; the finer-grained `assets.view`/`assets.manage` permission split
 * stays enforced client-side (`useMemberSession().can(...)`), exactly as
 * `AssetLibraryView.tsx` already does it — this checkpoint doesn't change
 * that convention.
 */
const GENERIC_ACCESS_ERROR = "The Asset Library isn't available. You may not have access to it.";

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

export async function createAssetFolderAction(input: MediaFolderInput): Promise<DataResult<MediaFolder>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);
  return createMediaFolder(input);
}

export async function moveAssetFolderAction(id: string, newParentFolderId: string | null): Promise<DataResult<MediaFolder>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);
  return moveMediaFolder(id, newParentFolderId);
}

/** Composes the real `archiveMediaFolder` with this checkpoint's own delete validation (`canDeleteFolder`) run first — the one real gap `archiveMediaFolder` alone doesn't check. */
export async function archiveAssetFolderAction(id: string): Promise<DataResult<MediaFolder>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const [folders, assets] = await Promise.all([getMediaFolders({ includeArchived: true }), listMediaAssetsForWorkspace(session.workspace.id, { includeArchived: true })]);
  const check = canDeleteFolder(id, folders, assets);
  if (!check.allowed) return fail(check.reason ?? "This folder cannot be archived yet.");

  return archiveMediaFolder(id);
}

export async function getAssetFolderTreeAction(): Promise<DataResult<FolderTreeNode[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const [folders, assets] = await Promise.all([getMediaFolders({}), listMediaAssetsForWorkspace(session.workspace.id)]);
  return ok(buildFolderTree(null, folders, assets));
}

// ---------------------------------------------------------------------------
// Versions (Step 4)
// ---------------------------------------------------------------------------

/** Captures the outgoing version's snapshot into `assetVersionsStore` *before* calling the real `replaceMediaAssetVersion` — the only way this checkpoint's own version history stays complete, since the repository action itself overwrites the row in place. */
export async function createAssetVersionAction(assetId: string, input: ReplaceMediaAssetVersionInput): Promise<DataResult<MediaAsset>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const existing = await getMediaAssetById(assetId).catch(() => null);
  if (!existing || existing.workspace_id !== session.workspace.id) return fail("This file could not be found.");

  const outgoing = buildOutgoingVersion(existing, session.workspace.id);
  writeAssetVersions([...readAssetVersions(), outgoing]);

  return replaceMediaAssetVersion(assetId, input);
}

export async function getAssetVersionHistoryAction(assetId: string): Promise<DataResult<AssetVersion[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const asset = await getMediaAssetById(assetId).catch(() => null);
  if (!asset || asset.workspace_id !== session.workspace.id) return fail("This file could not be found.");

  return ok(fullVersionHistory(asset, readAssetVersions()));
}

export async function compareAssetVersionsAction(assetId: string, versionA: number, versionB: number): Promise<DataResult<MetadataFieldDiff[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const asset = await getMediaAssetById(assetId).catch(() => null);
  if (!asset || asset.workspace_id !== session.workspace.id) return fail("This file could not be found.");

  const history = fullVersionHistory(asset, readAssetVersions());
  const a = history.find((v) => v.version === versionA);
  const b = history.find((v) => v.version === versionB);
  if (!a || !b) return fail("One or both versions could not be found.");

  return ok(compareVersionMetadata(a.snapshot, b.snapshot));
}

export async function restoreAssetVersionPlaceholderAction(assetId: string, version: number): Promise<DataResult<RestorePlaceholderResult>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const asset = await getMediaAssetById(assetId).catch(() => null);
  if (!asset || asset.workspace_id !== session.workspace.id) return fail("This file could not be found.");

  const target = fullVersionHistory(asset, readAssetVersions()).find((v) => v.version === version);
  if (!target) return fail("That version could not be found.");

  recordTimelineActivity(session.workspace.id, "media_asset", assetId, "asset_version_restore_attempted", `Restore requested for v${version} of "${asset.original_filename}"`);
  return ok(restoreVersionPlaceholder(target));
}

// ---------------------------------------------------------------------------
// Search (Step 5)
// ---------------------------------------------------------------------------

export async function searchAssetsAction(filters: AssetSearchFilters): Promise<DataResult<AssetSearchResult[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const [assets, collections] = await Promise.all([listMediaAssetsForWorkspace(session.workspace.id), getMediaCollections()]);
  const favoriteAssetIds = new Set(readAssetFavorites().filter((f) => f.workspace_id === session.workspace.id && f.member_id === session.membership.id).map((f) => f.asset_id));

  return ok(searchAssets(assets, filters, collections, favoriteAssetIds));
}

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------

export async function toggleAssetFavoriteAction(assetId: string): Promise<DataResult<{ favorited: boolean }>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const existing = readAssetFavorites().find((f) => f.asset_id === assetId && f.member_id === session.membership.id);
  if (existing) {
    writeAssetFavorites(readAssetFavorites().filter((f) => f.id !== existing.id));
    return ok({ favorited: false });
  }

  const favorite: AssetFavorite = { id: generateId("assetfavorite"), workspace_id: session.workspace.id, asset_id: assetId, member_id: session.membership.id, created_at: nowIso() };
  writeAssetFavorites([...readAssetFavorites(), favorite]);
  await getCoreKnowledgeGraphService().createRelationship(session.workspace.id, session.membership.id, {
    sourceNodeType: "media_asset",
    sourceNodeId: assetId,
    targetNodeType: "team_member",
    targetNodeId: session.membership.id,
    relationshipType: "favorited_by",
    source: "user_action",
  });
  return ok({ favorited: true });
}

export async function listFavoriteAssetIdsAction(): Promise<DataResult<string[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);
  return ok(readAssetFavorites().filter((f) => f.workspace_id === session.workspace.id && f.member_id === session.membership.id).map((f) => f.asset_id));
}

// ---------------------------------------------------------------------------
// Comments — thin composition of the real Comments Platform
// ---------------------------------------------------------------------------

export async function commentOnAssetAction(assetId: string, input: CreateCommentInput): Promise<DataResult<Comment>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const asset = await getMediaAssetById(assetId).catch(() => null);
  if (!asset || asset.workspace_id !== session.workspace.id) return fail("This file could not be found.");

  const result = await getCoreCommentsService().createComment(session.workspace.id, session.profile.full_name ?? session.user.email, "media_asset", assetId, input);
  if (!result.success) return result;

  recordTimelineActivity(session.workspace.id, "media_asset", assetId, "asset_comment_added", `Comment added to "${asset.original_filename}"`);
  return result;
}

export async function listAssetCommentsAction(assetId: string): Promise<DataResult<Comment[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);
  return ok(await getCoreCommentsService().getCommentsForOwner(session.workspace.id, "media_asset", assetId));
}

// ---------------------------------------------------------------------------
// Reviews — the approval-decision audit trail the real repository doesn't keep
// ---------------------------------------------------------------------------

export async function reviewAssetAction(assetId: string, decision: AssetReviewDecision, reason?: string | null): Promise<DataResult<MediaAsset>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const existing = await getMediaAssetById(assetId).catch(() => null);
  if (!existing || existing.workspace_id !== session.workspace.id) return fail("This file could not be found.");

  const status: MediaAssetStatus = decision;
  const result = await setMediaAssetStatus(assetId, status, session.profile.full_name ?? session.user.email, reason ?? null, session.membership.id);
  if (!result.success) return result;

  const review: AssetReview = {
    id: generateId("assetreview"),
    workspace_id: session.workspace.id,
    asset_id: assetId,
    decision,
    reviewer: session.profile.full_name ?? session.user.email,
    reviewer_member_id: session.membership.id,
    reason: reason ?? null,
    reviewed_at: nowIso(),
  };
  writeAssetReviews([...readAssetReviews(), review]);

  return result;
}

export async function listAssetReviewsAction(assetId: string): Promise<DataResult<AssetReview[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);
  return ok(readAssetReviews().filter((r) => r.asset_id === assetId && r.workspace_id === session.workspace.id));
}

// ---------------------------------------------------------------------------
// Share Placeholder
// ---------------------------------------------------------------------------

export async function shareAssetAction(assetId: string, visibility: AssetShareVisibility, sharedWithMemberIds: string[], note?: string | null): Promise<DataResult<AssetShare>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const asset = await getMediaAssetById(assetId).catch(() => null);
  if (!asset || asset.workspace_id !== session.workspace.id) return fail("This file could not be found.");

  const share: AssetShare = {
    id: generateId("assetshare"),
    workspace_id: session.workspace.id,
    asset_id: assetId,
    visibility,
    shared_by: session.profile.full_name ?? session.user.email,
    shared_with_member_ids: sharedWithMemberIds,
    note: note ?? null,
    created_at: nowIso(),
    revoked_at: null,
  };
  writeAssetShares([...readAssetShares(), share]);

  recordTimelineActivity(session.workspace.id, "media_asset", assetId, "asset_shared", `"${asset.original_filename}" shared`);
  return ok(share);
}

export async function listAssetSharesAction(assetId: string): Promise<DataResult<AssetShare[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);
  return ok(readAssetShares().filter((s) => s.asset_id === assetId && s.workspace_id === session.workspace.id));
}

// ---------------------------------------------------------------------------
// Downloads / Views — usage-tracking counters
// ---------------------------------------------------------------------------

/** Called alongside a real download (`downloadMediaAsset`), never from the button merely being visible. */
export async function downloadAssetAction(assetId: string): Promise<DataResult<{ blob: Blob; mediaAsset: MediaAsset }>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const existing = await getMediaAssetById(assetId).catch(() => null);
  if (!existing || existing.workspace_id !== session.workspace.id) return fail("This file could not be found.");

  const result = await downloadMediaAsset(assetId);
  if (!result.success) return result;

  writeAssetDownloads([...readAssetDownloads(), { id: generateId("assetdownload"), workspace_id: session.workspace.id, asset_id: assetId, version: result.data.mediaAsset.version, downloaded_by: session.membership.id, downloaded_at: nowIso() }]);
  recordTimelineActivity(session.workspace.id, "media_asset", assetId, "asset_downloaded", `"${result.data.mediaAsset.original_filename}" downloaded`);
  return result;
}

export async function recordAssetViewAction(assetId: string): Promise<DataResult<null>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const existing = await getMediaAssetById(assetId).catch(() => null);
  if (!existing || existing.workspace_id !== session.workspace.id) return fail("This file could not be found.");

  writeAssetViews([...readAssetViews(), { id: generateId("assetview"), workspace_id: session.workspace.id, asset_id: assetId, viewed_by: session.membership.id, viewed_at: nowIso() }]);
  return ok(null);
}

// ---------------------------------------------------------------------------
// Visibility override (Step 9)
// ---------------------------------------------------------------------------

export async function setAssetVisibilityAction(assetId: string, visibility: AssetVisibility): Promise<DataResult<AssetVisibility>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const existing = await getMediaAssetById(assetId).catch(() => null);
  if (!existing || existing.workspace_id !== session.workspace.id) return fail("This file could not be found.");

  writeAssetVisibilityOverrides({ ...readAssetVisibilityOverrides(), [assetId]: visibility });
  return ok(visibility);
}

// ---------------------------------------------------------------------------
// Evaluate Asset — the Asset Detail page's own read model (Step 18)
// ---------------------------------------------------------------------------

export interface AssetEvaluation {
  asset: MediaAsset;
  metadata: AssetMetadataSummary;
  preview: AssetPreview;
  usage: AssetUsageSummary;
  permission: AssetPermission;
  health: AssetHealth;
  versions: AssetVersion[];
  reviews: AssetReview[];
  shares: AssetShare[];
  isFavorited: boolean;
}

export async function evaluateAssetAction(assetId: string): Promise<DataResult<AssetEvaluation>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const asset = await getMediaAssetById(assetId).catch(() => null);
  if (!asset || asset.workspace_id !== session.workspace.id) return fail("This file could not be found.");

  const [outbound, inbound, documents, allAssets] = await Promise.all([
    getCoreKnowledgeGraphService().getOutboundRelationships(session.workspace.id, { nodeType: "media_asset", nodeId: assetId }),
    getCoreKnowledgeGraphService().getInboundRelationships(session.workspace.id, { nodeType: "media_asset", nodeId: assetId }),
    getDocuments({}),
    listMediaAssetsForWorkspace(session.workspace.id),
  ]);

  const previewType = resolvePreviewType(asset);
  const preview = buildAssetPreview(asset);
  const usage = resolveAssetUsage(
    asset,
    [...outbound, ...inbound],
    documents.filter((d) => d.media_asset_id === assetId).map((d) => ({ id: d.id, title: d.title })),
  );
  const visibility = resolveAssetVisibility(asset, readAssetVisibilityOverrides());
  const viewer: AssetPermissionViewer = { context: "team", canManage: session.permissions.includes("assets.manage") };
  const permission = evaluateAssetPermission(asset, visibility, viewer);
  const metadata = summarizeAssetMetadata(asset, previewType);
  const otherChecksums = allAssets.filter((a) => a.id !== assetId && !a.archived_at).map((a) => a.checksum);
  const health = evaluateAssetHealth(asset, { isUnused: usage.isUnused, metadataComplete: metadata.isComplete, previewType, visibility, otherActiveChecksums: otherChecksums });

  const [versions, reviews, shares, favoriteIds] = await Promise.all([getAssetVersionHistoryAction(assetId), listAssetReviewsAction(assetId), listAssetSharesAction(assetId), listFavoriteAssetIdsAction()]);

  return ok({
    asset,
    metadata,
    preview,
    usage,
    permission,
    health,
    versions: versions.success ? versions.data : [],
    reviews: reviews.success ? reviews.data : [],
    shares: shares.success ? shares.data : [],
    isFavorited: favoriteIds.success ? favoriteIds.data.includes(assetId) : false,
  });
}

// ---------------------------------------------------------------------------
// Evaluate Platform — the Dashboard's own read model (Step 17)
// ---------------------------------------------------------------------------

export interface PlatformEvaluation {
  health: PlatformHealthSummary;
  analytics: AssetAnalytics;
}

export async function evaluatePlatformAction(): Promise<DataResult<PlatformEvaluation>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const [assets, folders, clients, documents] = await Promise.all([listMediaAssetsForWorkspace(session.workspace.id), getMediaFolders({}), getClients(), getDocuments({})]);
  const overrides = readAssetVisibilityOverrides();
  const activeAssets = assets.filter((a) => !a.archived_at);

  const healthResults: AssetHealth[] = await Promise.all(
    activeAssets.map(async (asset) => {
      const [outbound, inbound] = await Promise.all([
        getCoreKnowledgeGraphService().getOutboundRelationships(session.workspace.id, { nodeType: "media_asset", nodeId: asset.id }),
        getCoreKnowledgeGraphService().getInboundRelationships(session.workspace.id, { nodeType: "media_asset", nodeId: asset.id }),
      ]);
      const usage = resolveAssetUsage(
        asset,
        [...outbound, ...inbound],
        documents.filter((d) => d.media_asset_id === asset.id).map((d) => ({ id: d.id, title: d.title })),
      );
      const previewType = resolvePreviewType(asset);
      const metadata = summarizeAssetMetadata(asset, previewType);
      const visibility = resolveAssetVisibility(asset, overrides);
      const otherChecksums = activeAssets.filter((a) => a.id !== asset.id).map((a) => a.checksum);
      return evaluateAssetHealth(asset, { isUnused: usage.isUnused, metadataComplete: metadata.isComplete, previewType, visibility, otherActiveChecksums: otherChecksums });
    }),
  );

  const unusedAssetIds = new Set(healthResults.filter((h) => h.issues.some((i) => i.type === "unused_asset")).map((h) => h.assetId));
  const commentCountByAssetId: Record<string, number> = {};
  for (const asset of activeAssets) {
    commentCountByAssetId[asset.id] = (await getCoreCommentsService().getCommentsForOwner(session.workspace.id, "media_asset", asset.id)).length;
  }
  const clientNameByOwnerId = Object.fromEntries(clients.map((c) => [c.id, `${c.first_name} ${c.last_name}`.trim()]));

  const analytics = buildAssetAnalytics({
    workspaceId: session.workspace.id,
    assets,
    folders,
    downloads: readAssetDownloads().filter((d) => d.workspace_id === session.workspace.id),
    views: readAssetViews().filter((v) => v.workspace_id === session.workspace.id),
    favorites: readAssetFavorites().filter((f) => f.workspace_id === session.workspace.id),
    shares: readAssetShares().filter((s) => s.workspace_id === session.workspace.id),
    commentCountByAssetId,
    clientNameByOwnerId,
    unusedAssetIds,
  });

  return ok({ health: summarizePlatformHealth(session.workspace.id, healthResults), analytics });
}

// ---------------------------------------------------------------------------
// Executive Decisions (Step 14) — zero-arg seam, `[]` on no session
// ---------------------------------------------------------------------------

export async function digitalAssetsRecommendationsForExecutiveDecisions(): Promise<OperationalRecommendation[]> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return [];

  const evaluation = await evaluatePlatformAction();
  const assets = await listMediaAssetsForWorkspace(session.workspace.id);
  if (!evaluation.success) return [];

  const healthResults: AssetHealth[] = await Promise.all(
    assets
      .filter((asset) => !asset.archived_at)
      .map(async (asset) => {
        const [outbound, inbound, documents] = await Promise.all([
          getCoreKnowledgeGraphService().getOutboundRelationships(session.workspace.id, { nodeType: "media_asset", nodeId: asset.id }),
          getCoreKnowledgeGraphService().getInboundRelationships(session.workspace.id, { nodeType: "media_asset", nodeId: asset.id }),
          getDocuments({}),
        ]);
        const usage = resolveAssetUsage(
          asset,
          [...outbound, ...inbound],
          documents.filter((d) => d.media_asset_id === asset.id).map((d) => ({ id: d.id, title: d.title })),
        );
        const previewType = resolvePreviewType(asset);
        const metadata = summarizeAssetMetadata(asset, previewType);
        const visibility = resolveAssetVisibility(asset, readAssetVisibilityOverrides());
        return evaluateAssetHealth(asset, { isUnused: usage.isUnused, metadataComplete: metadata.isComplete, previewType, visibility, otherActiveChecksums: [] });
      }),
  );

  return buildExecutiveRecommendations(healthResults, assets, evaluation.data.health);
}
