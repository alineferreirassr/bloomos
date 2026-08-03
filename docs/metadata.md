# Asset Metadata

`core/digitalAssets/metadataEngine.ts` — extends, never duplicates, `core/media/metadataEngine.ts` (Checkpoint 25's own `computeAspectRatio`/`computeOrientation`).

## Every field the spec names already existed

File size, dimensions, duration, page count, mime type, extension, checksum, created/updated timestamps are all real, stored fields on `MediaAsset` — none of them needed computing for the first time. This checkpoint's own Metadata Engine is a presentation/composition layer for the Asset Detail page's Metadata section, plus one genuinely new deterministic answer: **is this asset's metadata complete.**

## Completeness, defined precisely

`isMetadataComplete(asset, previewType)` only counts a field against completeness when it's *applicable* to that asset's own preview type — an audio file with `width: null` isn't missing anything, since audio has no dimensions:

- `original_filename` is never empty (repository-enforced; checked for clarity, not because it can realistically fail)
- `metadata.author` must be set
- `width`/`height` must both be set, but **only** for `image`/`video` preview types

This feeds directly into the Health Engine's own `missing_metadata` issue — see [`asset-health.md`](asset-health.md).

## Named functions

| Function | Purpose |
|---|---|
| `isMetadataComplete(asset, previewType)` | The one completeness check the Health Engine consumes |
| `summarizeAssetMetadata(asset, previewType)` | Formatted `AssetMetadataSummary` for the Asset Detail page: file size label, dimensions label, aspect ratio, orientation, duration label, page count, mime type, extension, checksum, formatted dates, `isComplete` |
