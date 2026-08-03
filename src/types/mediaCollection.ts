/**
 * v2.0 Checkpoint 25, Steps 3 & 14 — Collections & Collections Intelligence.
 * Distinct from `MediaFolder`: a folder is exactly one place a file lives
 * (a filing structure); a Collection is a named, curated set an asset can
 * belong to *alongside* its folder, and an asset can belong to many
 * Collections at once (`asset_ids` is a many-to-many membership list, kept
 * on the Collection rather than the Asset so adding an asset to a new
 * Collection never touches the asset row itself).
 */
export const MEDIA_COLLECTION_KINDS = ["manual", "smart", "template"] as const;
export type MediaCollectionKind = (typeof MEDIA_COLLECTION_KINDS)[number];

/** Step 14's own named starter set — a smart collection's `smart_rule` selects assets by tag/category rather than manual membership. */
export const MEDIA_COLLECTION_TEMPLATES = ["wedding_collection", "proposal_assets", "vendor_library", "brand_kit", "marketing_kit", "client_deliverables", "event_gallery", "templates"] as const;
export type MediaCollectionTemplate = (typeof MEDIA_COLLECTION_TEMPLATES)[number];

export const MEDIA_COLLECTION_TEMPLATE_LABELS: Record<MediaCollectionTemplate, string> = {
  wedding_collection: "Wedding Collection",
  proposal_assets: "Proposal Assets",
  vendor_library: "Vendor Library",
  brand_kit: "Brand Kit",
  marketing_kit: "Marketing Kit",
  client_deliverables: "Client Deliverables",
  event_gallery: "Event Gallery",
  templates: "Templates",
};

export interface SmartCollectionRule {
  /** All non-empty conditions must match (AND) — deliberately simple and deterministic, no query language to parse. */
  requiredTags?: string[];
  colorLabel?: string | null;
  aiReadyOnly?: boolean;
}

export interface MediaCollection {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  kind: MediaCollectionKind;
  template: MediaCollectionTemplate | null;
  asset_ids: string[];
  smart_rule: SmartCollectionRule | null;
  is_favorite: boolean;
  is_pinned: boolean;
  shared_with_member_ids: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}
