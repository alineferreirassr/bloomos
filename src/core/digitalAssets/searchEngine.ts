import type { MediaAsset } from "@/types/mediaAsset";
import type { MediaCollection } from "@/types/mediaCollection";
import type { AssetSearchFilters, AssetSearchResult, AssetSearchableField } from "@/types/digitalAssets";

/**
 * v2.0 Checkpoint 37, Step 5 — Search Engine. The genuinely missing piece
 * per this checkpoint's own research: `AssetLibraryView.tsx` only ever had
 * a client-side filename/tag filter. This is a pure, deterministic
 * multi-field search over already-fetched `MediaAsset[]` — no index, no
 * fuzzy ranking, no external search service, matching the spec's own
 * "deterministic search" requirement.
 *
 * Field mapping notes (every asset field this checkpoint can honestly
 * search, since `MediaAsset` has no dedicated `title`/`description`):
 * - "filename"/"title" both match `original_filename` — there is no
 *   separate title field on `MediaAsset`, so inventing a second one just to
 *   satisfy the spec's naming would be a fabricated field, not a reused one.
 * - "description" matches `version_notes` — the closest free-text field a
 *   real asset carries.
 * - "client"/"proposal"/"contract"/"invoice"/"event" search by the asset's
 *   own real `owner_type`/`owner_id` (its actual polymorphic owner) via
 *   `filters.ownerType`/`filters.ownerId` — never a fuzzy name lookup that
 *   would require resolving every possible owner table.
 * - "journey" has no dedicated match: Client Journey (Checkpoint 32) is a
 *   computed read model over `lead`/`client`, not something an asset is
 *   ever directly owned by — searching `ownerType: "client"` already
 *   reaches every asset a Journey view would surface.
 * - "workspace" is implicit — every asset passed in is already scoped to
 *   one workspace by the caller.
 */
export function searchAssets(assets: MediaAsset[], filters: AssetSearchFilters, collections: MediaCollection[] = [], favoriteAssetIds: ReadonlySet<string> = new Set()): AssetSearchResult[] {
  const query = filters.query?.trim().toLowerCase() ?? "";
  const fromMs = filters.dateFrom ? new Date(filters.dateFrom).getTime() : null;
  const toMs = filters.dateTo ? new Date(filters.dateTo).getTime() : null;
  const collectionMemberIds = filters.collectionId ? new Set(collections.find((c) => c.id === filters.collectionId)?.asset_ids ?? []) : null;

  const results: AssetSearchResult[] = [];

  for (const asset of assets) {
    if (filters.ownerType && asset.owner_type !== filters.ownerType) continue;
    if (filters.ownerId && asset.owner_id !== filters.ownerId) continue;
    if (filters.folderId !== undefined && asset.folder_id !== filters.folderId) continue;
    if (collectionMemberIds && !collectionMemberIds.has(asset.id)) continue;
    if (filters.mimeType && asset.mime_type !== filters.mimeType) continue;
    if (filters.extension && asset.extension.toLowerCase() !== filters.extension.toLowerCase()) continue;
    if (filters.status && asset.status !== filters.status) continue;
    if (filters.favoriteOnly && !favoriteAssetIds.has(asset.id)) continue;
    if (filters.tags && filters.tags.length > 0 && !filters.tags.every((tag) => asset.tags.includes(tag))) continue;

    const createdMs = new Date(asset.created_at).getTime();
    if (fromMs !== null && createdMs < fromMs) continue;
    if (toMs !== null && createdMs > toMs) continue;

    const matchedFields: AssetSearchableField[] = [];
    if (query.length > 0) {
      if (asset.original_filename.toLowerCase().includes(query)) {
        matchedFields.push("filename", "title");
      }
      if (asset.version_notes?.toLowerCase().includes(query)) {
        matchedFields.push("description");
      }
      if (asset.tags.some((tag) => tag.toLowerCase().includes(query))) {
        matchedFields.push("tags");
      }
      if (asset.mime_type.toLowerCase().includes(query)) {
        matchedFields.push("mime_type");
      }
      if (asset.extension.toLowerCase().includes(query)) {
        matchedFields.push("extension");
      }
      if (matchedFields.length === 0) continue;
    }

    results.push({ asset, matchedFields });
  }

  return results;
}
