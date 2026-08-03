# Asset Versioning

`core/digitalAssets/versionEngine.ts` + `AssetVersion`/`AssetSnapshot` (`types/digitalAssets.ts`).

## The real gap this closes

The real `replaceMediaAssetVersion` repository action (Checkpoint 25) mutates the `MediaAsset` row in place — the current version always lives on the row itself, and nothing before this checkpoint kept a record of what was overwritten. Version numbering, "latest version," and "current version" were already correct (the row's own `version` field, incremented by the repository); what was missing was the *history*.

## How history is captured

`createAssetVersionAction` (module layer, Step 15) is a thin wrapper: before calling the real `replaceMediaAssetVersion`, it calls `buildOutgoingVersion(asset, workspaceId)` to freeze the current row's file descriptor (`AssetSnapshot`) into an `AssetVersion` row, writes it to `assetVersionsStore`, *then* calls the real replace. The stored history is therefore exactly the superseded versions; `fullVersionHistory(asset, storedVersions)` reconstructs the complete list by prepending a synthetic entry for the still-live current version — never a second copy of the live row.

## Metadata comparison

`compareVersionMetadata(a, b)` diffs two `AssetSnapshot`s field-by-field (file size, dimensions, duration, checksum, mime type, and every `MediaAssetMetadata` field) — deterministic, no fuzzy matching, each field flagged `changed: true/false`.

## Restore placeholder

"Restore placeholder" (spec) is genuinely inert: restoring a prior version would need re-uploading its exact original bytes, and the live blob store only ever keeps the *current* version's bytes — a superseded version's `AssetSnapshot` records its file descriptor, never the file body. `restoreVersionPlaceholder(version)` always returns `{ supported: false, message: "..." }` and the action logs the attempt (`asset_version_restore_attempted` Timeline event) rather than silently pretending to succeed.

## Named functions

| Function | Purpose |
|---|---|
| `snapshotFromAsset(asset)` | Freezes the file-descriptor fields into an `AssetSnapshot` |
| `buildOutgoingVersion(asset, workspaceId)` | Builds the `AssetVersion` row to persist before a replace |
| `nextVersionNumber(asset)` | Display-only; the real repository owns the actual increment |
| `fullVersionHistory(asset, storedVersions)` | Current + stored versions, newest first |
| `latestVersion(asset, storedVersions)` | The first entry of `fullVersionHistory` |
| `compareVersionMetadata(a, b)` | Field-by-field diff between two snapshots |
| `restoreVersionPlaceholder(version)` | Always `supported: false` |
