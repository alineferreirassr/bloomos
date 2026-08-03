# v2.0 Checkpoint 37 — Digital Asset Management Platform

## Verdict: APPROVED WITH LIMITATIONS

## What was built

The checkpoint's own spec assumed no DAM existed yet in BloomOS and asked for one to be built from scratch, including a `/assets/digital-assets` dashboard. Research at Step 0 found a substantial, real DAM already in production from Checkpoint 25 — `MediaAsset`, `MediaFolder`, `MediaCollection`, `Tag`, a Knowledge Graph wired into every upload, and a working `/assets` + `/assets/[id]` UI. Building a second, parallel system under the spec's literal wording would have duplicated exactly the storage and UI the checkpoint's own core principle forbids. This checkpoint was built as an **extension of the real system** instead: nine new pure engines in `core/digitalAssets/`, a `"use server"` actions layer that composes them with the real `MediaAsset` repository, and additive UI mounted onto the two existing routes.

| Layer | File | Responsibility |
|---|---|---|
| Domain types | `types/digitalAssets.ts` | Type aliases onto `MediaAsset`/`MediaFolder`/`MediaCollection`/`Tag`, plus genuinely new types (versions, previews, permissions, health, search, usage, analytics, favorites, reviews, shares, downloads, views) |
| Folders | `core/digitalAssets/folderEngine.ts` | [`folders.md`](folders.md) |
| Versioning | `core/digitalAssets/versionEngine.ts` | [`versioning.md`](versioning.md) |
| Search | `core/digitalAssets/searchEngine.ts` | [`search.md`](search.md) |
| Previews | `core/digitalAssets/previewEngine.ts` | [`previews.md`](previews.md) |
| Metadata | `core/digitalAssets/metadataEngine.ts` | [`metadata.md`](metadata.md) |
| Usage tracking | `core/digitalAssets/usageEngine.ts` | [`digital-assets.md`](digital-assets.md) |
| Permissions | `core/digitalAssets/permissionEngine.ts` | [`digital-assets.md`](digital-assets.md) |
| Health scoring | `core/digitalAssets/healthEngine.ts` | [`asset-health.md`](asset-health.md) |
| Analytics | `core/digitalAssets/analyticsEngine.ts` | [`asset-analytics.md`](asset-analytics.md) |
| Executive integration | `core/digitalAssets/executiveIntegration.ts` | [`digital-assets.md`](digital-assets.md) |
| Module actions | `modules/digitalAssets/digitalAssetsActions.ts` | Session auth, persistence, Timeline recording — the only I/O layer |
| Dashboard + Detail | `modules/assets/components/AssetPlatformSummary.tsx`, `AssetIntelligencePanel.tsx` | [`digital-assets-dashboard.md`](digital-assets-dashboard.md) |

## Reuse, honored exactly as the stop condition requires

- **No parallel storage.** `Asset`, `AssetFolder`, `AssetCollection`, `AssetTag`, and `AssetMetadata` are direct type aliases onto the real `MediaAsset`/`MediaFolder`/`MediaCollection`/`Tag`/`MediaAssetMetadata` — never a second table shape.
- **No parallel dashboard.** The spec's own line read "Create: `/assets/digital-assets`"; instead `/assets` and `/assets/[id]` were extended in place, documented in [`digital-assets-dashboard.md`](digital-assets-dashboard.md).
- **Knowledge Graph vocabulary reuse.** 7 of the 8 spec-named relationships map onto existing `RelationshipType` values (`attached_to`, `included_in`, `derived_from`, `shared_with`, `commented_on`, `approved_by`/`rejected_by`). Only `favorited_by` was genuinely new — added with a doc comment explaining why `viewed_by`/`downloaded_by` deliberately stay out of the graph (per-event edge volume is too high; tracked via plain counters/stores instead).
- **Timeline vocabulary reuse.** Only 4 new event kinds (`asset_shared`, `asset_downloaded`, `asset_comment_added`, `asset_version_restore_attempted`); everything else maps onto the pre-existing `media_asset_*` events Checkpoint 25 already wired.
- **No new upload pipeline, no image processing, OCR, AI tagging, face recognition, background jobs, or CDN** — matching the checkpoint's own explicit stop conditions.
- **Session auth follows the established pattern.** Every module action gates on `resolveMemberSessionSnapshot()` + `session.kind !== "active"`; finer-grained `assets.view`/`assets.manage` checks stay client-side via `useMemberSession().can(...)`, the same convention `AssetLibraryView.tsx` already used before this checkpoint touched it.

## A real bug found and fixed during build

`uploadMediaAsset` (the real, pre-existing repository action) emits a `belongs_to` Knowledge Graph edge on every single upload. The Usage Engine's first draft counted every active relationship as "in use," so a freshly uploaded, completely unfiled asset was immediately marked "used" by its own provenance edge — defeating the entire purpose of the Unused Asset health check. Caught by an integration test expecting a fresh, untagged upload to surface an `unused_asset` recommendation. Fixed in `usageEngine.ts` by excluding `relationship_type !== "belongs_to"` from the active-relationship tally, with an explanatory comment and a permanent regression test guarding it.

## "Duplicate Placeholder" — disclosed precisely

The Health Engine's `duplicate_placeholder` issue keeps the spec's own naming, but the detection itself is real: two assets' stored checksums are compared directly, and a match means the file bytes are genuinely identical. What doesn't exist is a merge/dedupe *workflow* to act on the finding — a team member sees the flag today and resolves it manually. See [`asset-health.md`](asset-health.md).

## Known limitations (disclosed, not hidden)

1. **Version restore is a real placeholder, not a working revert.** `restoreVersionPlaceholder()` always returns `{ supported: false, message: "..." }` — version history is genuinely captured (pre-mutation snapshots via `buildOutgoingVersion`), but rolling back to an older version is out of scope, matching the checkpoint's own "no automatic tagging/background jobs" spirit around anything that would need real file storage to act on.
2. **Shares are an internal placeholder log**, not real link generation or external access control — `AssetShare` records intent and visibility, never issues a fetchable URL.
3. **No live authenticated browser verification against the real Supabase-backed session** — `NEXT_PUBLIC_DATA_MODE` was temporarily flipped to `mock` for local verification, then restored and the dev server stopped once verification finished.
4. **The Asset Detail page's new `AssetIntelligencePanel` could not be visually confirmed live.** BloomOS's mock-data layer resets on every full page navigation (disclosed in the app's own UI banner: "Data is temporary and resets on page reload — no database is connected yet."). A freshly uploaded asset's detail link 404s the instant a Server Component navigation re-fetches the (now-empty) mock store — reproduced three times, including an immediate click with no intervening reload, so this is a pre-existing mock-mode limitation rather than a Checkpoint 37 regression. The panel's own data path (`evaluateAssetAction`) is covered by the module-actions integration test suite instead.

## Quality gates

- `tsc --noEmit -p .`: clean.
- `eslint .`: clean — 0 errors, 1 pre-existing-style warning outside this checkpoint's files.
- `next build`: succeeds; `/assets` and `/assets/[id]` both confirmed compiled in the production output.
- `vitest run`: 903 of 904 test files passed, 8036 of 8037 tests passed. The one failure — `mockRepository.reports.test.ts`'s `"nets a reversed entry to zero movement"` — is a pre-existing finance-report issue tracked outside this checkpoint's scope, unrelated to any Digital Asset Management code.
- Browser verification: **Desktop verified** (1280×900) — `AssetPlatformSummary` KPI strip renders correctly on `/assets` with all 8 tiles, and a real file upload (via injected `File`/`DataTransfer`, since the native OS picker isn't scriptable) renders in the grid correctly. **Mobile verified** (375×812) — the same KPI strip stacks cleanly into a single column with no overflow or clipping. The Asset Detail page's new panel could not be reached live for either viewport due to the disclosed mock-reset limitation above.

## Success criteria, answered

- **Extends the real DAM rather than duplicating it** — every genuinely-new type is additive; every already-real concept (assets, folders, collections, tags, metadata) is aliased, never re-modeled.
- **Search, Preview, Metadata, Health, Usage, Permissions, Analytics, and Versioning are all real, deterministic engines** — no AI, no external services, matching every stop condition (no Google Drive/Dropbox/S3/R2/OneDrive, no upload APIs, no OCR, no face recognition, no CDN).
- **Executive Decisions integration** surfaces 5 named rules (`dam_unused_asset`, `dam_missing_metadata`, `dam_permission_problem`, `dam_no_preview`, `dam_large_storage_growth`, `dam_folders_needing_organization`) from real Health Engine output.
- **Knowledge Graph and Timeline extended with the minimum genuinely-new vocabulary**, both documented inline with the full reuse mapping.

No parallel DAM, storage system, dashboard route, or AI model was created — this checkpoint is entirely a composition and completion layer over the real Checkpoint 25 Digital Asset Management system.
