import type { EntityType } from "@/core/enums/entityType";
import type { MediaAsset, MediaAssetMetadata } from "@/types/mediaAsset";
import type { MediaFolder } from "@/types/mediaFolder";
import type { MediaCollection } from "@/types/mediaCollection";
import type { Tag } from "@/types/tag";
import type { Comment } from "@/types/comment";
import type { MediaAssetStatus } from "@/core/enums/mediaAssetStatus";
import type { KnowledgeRelationship } from "@/types/knowledgeGraph";

/**
 * v2.0 Checkpoint 37 — Digital Asset Management Platform.
 *
 * An earlier phase (Checkpoint 25) already built the one real storage
 * system this app has for files: `MediaAsset` (+ `MediaFolder`/
 * `MediaCollection`/`Tag`), a full mock-and-Supabase repository pair with
 * real blob storage, an approval workflow, Timeline wiring, and Knowledge
 * Graph reuse. This checkpoint's own stop condition — "The DAM must be
 * reusable by every platform without creating duplicate storage systems"
 * — means the honest move is to finish that system, not build a second one
 * beside it. `Asset`/`AssetFolder`/`AssetCollection`/`AssetTag`/
 * `AssetMetadata` below are direct aliases onto the real types, never a
 * parallel schema; every genuinely new concept this checkpoint introduces
 * (versioning history, previews, health, analytics, search, favorites,
 * shares, downloads, reviews) is additive and reads the real `MediaAsset`
 * data, never a second source of truth for what a file *is*.
 */
export type Asset = MediaAsset;
export type AssetFolder = MediaFolder;
export type AssetCollection = MediaCollection;
export type AssetTag = Tag;
export type AssetMetadata = MediaAssetMetadata;

/** A short-form remark on an asset — the generic Comments Platform (Checkpoint 24) with `owner_type: "media_asset"`, never a second comment store. */
export type AssetComment = Comment;

/** A structural Knowledge Graph edge touching an asset node — the real graph (Checkpoint 25, Step 10.5), never a second relationship system. See `docs/digital-assets.md` for which named relationships from this checkpoint's own spec map onto which existing `RelationshipType`. */
export type AssetRelationship = KnowledgeRelationship;

// ---------------------------------------------------------------------------
// Step 4 — Version Engine: AssetVersion / AssetSnapshot
// ---------------------------------------------------------------------------

/**
 * The frozen, point-in-time file descriptor a version captures — mirrors
 * `ContractSnapshot`/`ProposalSnapshot`'s own "version list entry embeds a
 * frozen content snapshot" shape (Checkpoints 33/34), the established
 * precedent for versioned content in this codebase.
 */
export interface AssetSnapshot {
  original_filename: string;
  storage_path: string;
  mime_type: string;
  extension: string;
  file_size: number;
  checksum: string;
  width: number | null;
  height: number | null;
  duration: number | null;
  metadata: MediaAssetMetadata;
}

/**
 * `replaceMediaAssetVersion` (the real repository action) mutates the
 * `MediaAsset` row in place — the current/latest version always lives on
 * the row itself, never duplicated here. An `AssetVersion` is captured
 * the moment *before* a replace happens (by this checkpoint's own Version
 * Engine, see `core/digitalAssets/versionEngine.ts`), so the history this
 * checkpoint adds is exactly the superseded versions, not a second copy of
 * the live one.
 */
export interface AssetVersion {
  id: string;
  workspace_id: string;
  asset_id: string;
  version: number;
  snapshot: AssetSnapshot;
  version_notes: string | null;
  created_by: string | null;
  captured_at: string;
}

// ---------------------------------------------------------------------------
// Step 6 — Preview Engine: AssetPreview
// ---------------------------------------------------------------------------

export const PREVIEW_TYPES = ["image", "pdf", "video", "audio", "text", "spreadsheet", "presentation", "document", "unknown"] as const;
export type PreviewType = (typeof PREVIEW_TYPES)[number];

export const PREVIEW_TYPE_LABELS: Record<PreviewType, string> = {
  image: "Image",
  pdf: "PDF",
  video: "Video",
  audio: "Audio",
  text: "Text",
  spreadsheet: "Spreadsheet",
  presentation: "Presentation",
  document: "Document",
  unknown: "Unknown",
};

/**
 * "Never render actual files. Only determine preview behavior" (spec) — this
 * is a pure classification result, never a rendered thumbnail or embedded
 * viewer. `thumbnailAvailable` is always `false` this checkpoint (disclosed,
 * not a fabricated capability) since no thumbnail-generation pipeline exists
 * or is in scope.
 */
export interface AssetPreview {
  assetId: string;
  previewType: PreviewType;
  canRenderInline: boolean;
  thumbnailAvailable: boolean;
}

// ---------------------------------------------------------------------------
// Step 9 — Permission Engine: AssetPermission
// ---------------------------------------------------------------------------

export const ASSET_VISIBILITY_LEVELS = ["owner", "team", "client", "internal_only", "public_placeholder"] as const;
export type AssetVisibility = (typeof ASSET_VISIBILITY_LEVELS)[number];

export const ASSET_VISIBILITY_LABELS: Record<AssetVisibility, string> = {
  owner: "Owner Only",
  team: "Team",
  client: "Client",
  internal_only: "Internal Only",
  public_placeholder: "Public (Placeholder)",
};

export const ASSET_PERMISSION_ACTIONS = ["preview", "download", "comment", "share", "edit", "delete"] as const;
export type AssetPermissionAction = (typeof ASSET_PERMISSION_ACTIONS)[number];

export interface AssetPermissionCheck {
  action: AssetPermissionAction;
  allowed: boolean;
  reason: string | null;
}

/** One evaluated permission summary for one asset against one caller — computed fresh from the real `assets.view`/`assets.manage` permission plus the asset's own visibility, never a stored ACL row. */
export interface AssetPermission {
  assetId: string;
  visibility: AssetVisibility;
  checks: AssetPermissionCheck[];
}

// ---------------------------------------------------------------------------
// Step 10 — Health Engine: AssetHealth
// ---------------------------------------------------------------------------

export const ASSET_HEALTH_ISSUE_TYPES = ["unused_asset", "missing_metadata", "no_folder", "no_tags", "old_version", "no_preview", "permission_problem", "duplicate_placeholder"] as const;
export type AssetHealthIssueType = (typeof ASSET_HEALTH_ISSUE_TYPES)[number];

export const ASSET_HEALTH_ISSUE_LABELS: Record<AssetHealthIssueType, string> = {
  unused_asset: "Unused Asset",
  missing_metadata: "Missing Metadata",
  no_folder: "No Folder",
  no_tags: "No Tags",
  old_version: "Old Version",
  no_preview: "No Preview",
  permission_problem: "Permission Problem",
  duplicate_placeholder: "Possible Duplicate",
};

export interface AssetHealthIssue {
  type: AssetHealthIssueType;
  detail: string;
}

export const ASSET_HEALTH_BANDS = ["excellent", "good", "attention", "critical"] as const;
export type AssetHealthBand = (typeof ASSET_HEALTH_BANDS)[number];

export interface AssetHealth {
  assetId: string;
  score: number;
  band: AssetHealthBand;
  issues: AssetHealthIssue[];
  evaluatedAt: string;
}

export interface PlatformHealthSummary {
  workspaceId: string;
  averageScore: number;
  band: AssetHealthBand;
  assetsEvaluated: number;
  assetsWithIssues: number;
  issueBreakdown: Record<AssetHealthIssueType, number>;
  evaluatedAt: string;
}

// ---------------------------------------------------------------------------
// Step 5 — Search Engine: AssetSearchResult
// ---------------------------------------------------------------------------

export const ASSET_SEARCHABLE_FIELDS = ["filename", "title", "description", "client", "proposal", "contract", "invoice", "journey", "event", "workspace", "folder", "collection", "tags", "mime_type", "extension", "status", "date", "favorite"] as const;
export type AssetSearchableField = (typeof ASSET_SEARCHABLE_FIELDS)[number];

export interface AssetSearchFilters {
  query?: string;
  ownerType?: EntityType;
  ownerId?: string;
  folderId?: string | null;
  collectionId?: string;
  tags?: string[];
  mimeType?: string;
  extension?: string;
  status?: MediaAssetStatus;
  favoriteOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export interface AssetSearchResult {
  asset: MediaAsset;
  matchedFields: AssetSearchableField[];
}

// ---------------------------------------------------------------------------
// Step 8 — Usage Engine: where an asset is referenced
// ---------------------------------------------------------------------------

/** The closed set of places this checkpoint knows how to look for a real reference — every one backed by a genuine existing link (Knowledge Graph edge, `Document.media_asset_id`, or a real deliverable/portfolio pointer), never a guessed usage. */
export const ASSET_USAGE_CONTEXTS = ["proposal", "contract", "invoice", "client", "journey", "document", "execution_package", "dispatch", "timeline", "portfolio", "knowledge_graph"] as const;
export type AssetUsageContext = (typeof ASSET_USAGE_CONTEXTS)[number];

export interface AssetUsageReference {
  context: AssetUsageContext;
  nodeType: string;
  nodeId: string;
  label: string;
  href: string | null;
}

export interface AssetUsageSummary {
  assetId: string;
  references: AssetUsageReference[];
  isUnused: boolean;
}

// ---------------------------------------------------------------------------
// Step 11 — Analytics Engine: AssetAnalytics
// ---------------------------------------------------------------------------

export interface AssetStorageBreakdownEntry {
  key: string;
  label: string;
  bytes: number;
  assetCount: number;
}

export interface AssetAnalyticsTopEntry {
  assetId: string;
  filename: string;
  value: number;
}

export interface AssetAnalytics {
  workspaceId: string;
  totalAssets: number;
  totalStorageBytes: number;
  totalDownloads: number;
  totalViews: number;
  totalFavorites: number;
  totalShares: number;
  totalComments: number;
  storageByFolder: AssetStorageBreakdownEntry[];
  storageByClient: AssetStorageBreakdownEntry[];
  largestFiles: AssetAnalyticsTopEntry[];
  mostViewed: AssetAnalyticsTopEntry[];
  unusedAssetCount: number;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// New persisted entities (Step 2) — favorites / reviews / shares / downloads
// ---------------------------------------------------------------------------

export interface AssetFavorite {
  id: string;
  workspace_id: string;
  asset_id: string;
  member_id: string;
  created_at: string;
}

export const ASSET_REVIEW_DECISIONS = ["approved", "rejected", "needs_revision"] as const;
export type AssetReviewDecision = (typeof ASSET_REVIEW_DECISIONS)[number];

/** An audit-trail entry for one approval-workflow decision — `MediaAsset.status`/`approved_by`/`approved_at`/`rejection_reason` only ever holds the *current* state; this is the history those fields don't keep, captured by this checkpoint's own module action at the same moment it calls the real `setMediaAssetStatus`. */
export interface AssetReview {
  id: string;
  workspace_id: string;
  asset_id: string;
  decision: AssetReviewDecision;
  reviewer: string;
  reviewer_member_id: string | null;
  reason: string | null;
  reviewed_at: string;
}

export const ASSET_SHARE_VISIBILITY = ["team", "client", "link_placeholder"] as const;
export type AssetShareVisibility = (typeof ASSET_SHARE_VISIBILITY)[number];

/** "Share Placeholder" (spec) — records who an asset was shared with inside BloomOS; deliberately generates no real external link, email, or access token. */
export interface AssetShare {
  id: string;
  workspace_id: string;
  asset_id: string;
  visibility: AssetShareVisibility;
  shared_by: string;
  shared_with_member_ids: string[];
  note: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface AssetDownload {
  id: string;
  workspace_id: string;
  asset_id: string;
  version: number;
  downloaded_by: string | null;
  downloaded_at: string;
}

export interface AssetView {
  id: string;
  workspace_id: string;
  asset_id: string;
  viewed_by: string | null;
  viewed_at: string;
}
