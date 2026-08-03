# Asset Search

`core/digitalAssets/searchEngine.ts` — the genuinely missing piece per this checkpoint's own research: `AssetLibraryView.tsx` only ever had a client-side filename/tag filter. `searchAssets(assets, filters, collections, favoriteAssetIds)` is a pure, deterministic multi-field search — no index, no fuzzy ranking, no external search service.

## Field mapping

`MediaAsset` has no dedicated `title`/`description` field, so the spec's own named searchable fields map onto real fields rather than fabricated ones:

| Spec field | Matches |
|---|---|
| `filename` / `title` | `original_filename` (no separate title exists) |
| `description` | `version_notes` — the closest free-text field a real asset carries |
| `client` / `proposal` / `contract` / `invoice` / `document` | The asset's own real `owner_type`/`owner_id`, via `filters.ownerType`/`filters.ownerId` |
| `event` / `workspace` | Implicit — every asset passed in is already scoped to one workspace; "event" ownership exists but isn't a named usage context this checkpoint tracks (see `docs/digital-assets.md`'s Usage Engine section) |
| `journey` | No dedicated match — Client Journey is a computed read model with no asset FK of its own; searching `ownerType: "client"` already reaches everything a Journey view would surface |
| `folder` / `collection` / `tags` / `mime type` / `extension` / `status` / `date` / `favorite` | Direct filters: `folderId`, `collectionId` (resolved against `MediaCollection.asset_ids`), `tags` (every tag must match), `mimeType`, `extension`, `status`, `dateFrom`/`dateTo` (against `created_at`), `favoriteOnly` (against a caller-supplied favorite id set) |

## Named function

`searchAssets(assets: MediaAsset[], filters: AssetSearchFilters, collections?, favoriteAssetIds?): AssetSearchResult[]` — each result carries `matchedFields: AssetSearchableField[]`, so a UI can show *why* something matched, not just that it did.
