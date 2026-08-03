# Digital Asset Management Platform

Checkpoint 37 finishes the Digital Asset Management platform an earlier phase (internally, "Checkpoint 25") began: `MediaAsset` (+ `MediaFolder`/`MediaCollection`/`Tag`), a full mock-and-Supabase repository pair with real blob storage, an approval workflow, Timeline wiring, and Knowledge Graph reuse were already built and working. What was genuinely missing — a search engine, a preview-type classifier, real version history, usage tracking, a health/analytics layer, and a dashboard summary — is what this checkpoint adds.

## The one real architectural decision

This checkpoint's own spec asked for `src/types/digitalAssets.ts`, `src/core/digitalAssets/`, and `src/modules/digitalAssets/` under the assumption that no DAM existed yet — and its own core principle is explicit: **"The DAM must be reusable by every platform without creating duplicate storage systems."** Since a real one already exists, honoring that principle meant building this checkpoint as an *extension* of the real `MediaAsset` system, not a parallel one:

- `Asset`/`AssetFolder`/`AssetCollection`/`AssetTag`/`AssetMetadata` (`types/digitalAssets.ts`) are direct type aliases onto the real `MediaAsset`/`MediaFolder`/`MediaCollection`/`Tag`/`MediaAssetMetadata` — never a duplicated schema.
- Every genuinely new concept (version history, previews, health, analytics, search results, favorites, shares, downloads, reviews) is additive and reads the real `MediaAsset` data.
- The `/assets` Asset Library and `/assets/[id]` Asset Detail routes were **extended in place** — Steps 17/18's own spec line "Create: /assets/digital-assets" was deliberately not followed literally, since `/assets` is already the real dashboard and creating a second one under the same prefix would be the exact duplication the checkpoint's own principle forbids. See [`digital-assets-dashboard.md`](digital-assets-dashboard.md).
- `assets.view`/`assets.manage` (already fully wired into `permission.ts`/`permissionMatrix.ts`/`routeAccess.ts`/`navigation.ts`) are reused rather than adding a duplicate `digital_assets.view`/`digital_assets.manage` pair.

## What's new, by engine

| Engine | File | Doc |
|---|---|---|
| Folder | `core/digitalAssets/folderEngine.ts` | [`folders.md`](folders.md) |
| Version | `core/digitalAssets/versionEngine.ts` | [`versioning.md`](versioning.md) |
| Search | `core/digitalAssets/searchEngine.ts` | [`search.md`](search.md) |
| Preview | `core/digitalAssets/previewEngine.ts` | [`previews.md`](previews.md) |
| Metadata | `core/digitalAssets/metadataEngine.ts` | [`metadata.md`](metadata.md) |
| Usage | `core/digitalAssets/usageEngine.ts` | this doc, below |
| Permission | `core/digitalAssets/permissionEngine.ts` | this doc, below |
| Health | `core/digitalAssets/healthEngine.ts` | [`asset-health.md`](asset-health.md) |
| Analytics | `core/digitalAssets/analyticsEngine.ts` | [`asset-analytics.md`](asset-analytics.md) |
| Executive Decisions | `core/digitalAssets/executiveIntegration.ts` | this doc, below |
| Module actions | `modules/digitalAssets/digitalAssetsActions.ts` | this doc, below |

## New persisted entities (Step 2)

Seven small mock stores in `lib/data/mock/`, mirroring `mediaFoldersStore.ts`'s own "flat array, read/write/reset" shape — never a second repository abstraction:

| Store | Holds |
|---|---|
| `assetVersionsStore.ts` | Superseded version snapshots (`AssetVersion`) — captured before every real `replaceMediaAssetVersion` call |
| `assetFavoritesStore.ts` | One row per (asset, member) favorite |
| `assetReviewsStore.ts` | Approval-decision audit trail — the history `MediaAsset.status` alone doesn't keep |
| `assetSharesStore.ts` | "Share Placeholder" records — who a file was shared with inside BloomOS, no real external link |
| `assetDownloadsStore.ts` | One row per real download, recorded alongside the actual `downloadMediaAsset` call |
| `assetViewsStore.ts` | One row per Asset Detail page load |
| `assetVisibilityStore.ts` | Explicit visibility *overrides* per asset — falls back to a derived default when unset |

## Usage Engine (Step 8)

Determines where an asset is genuinely referenced from data that already exists: the asset's own `owner_type`/`owner_id` (when it's `client`/`contract`/`invoice`/`proposal`/`document`), real `Document.media_asset_id` back-references, and active Knowledge Graph edges touching the asset's node. The one correctness fix made mid-build: the real `uploadMediaAsset` repository action already emits a `belongs_to` provenance edge on every upload, which would have made the "Unused Asset" health check fire on nothing — `resolveAssetUsage` explicitly excludes `belongs_to` from the usage tally, since it's the same fact `owner_type`/`owner_id` already answers, not a genuine reference. "Journey"/"Dispatch"/"Timeline"/"Portfolio" are reserved vocabulary in `AssetUsageContext` — no real linkage exists anywhere in this codebase for any of them, disclosed rather than faked.

## Permission Engine (Step 9)

Visibility (`owner`/`team`/`client`/`internal_only`/`public_placeholder`) is derived deterministically from `owner_type` (client-owned → `client`, workspace-owned → `team`, everything else → `internal_only`), with an explicit per-asset override in `assetVisibilityStore.ts`. Six named actions (`preview`/`download`/`comment`/`share`/`edit`/`delete`) are evaluated per viewer context: a team member's edit/delete/share require the real `assets.manage` permission; a client viewer's every action requires both a client-facing visibility level *and* an `"approved"` status. **Correction (Checkpoint 45 Step 0 audit):** the sentence that used to be here claimed this held the Client Portal's Document/Contract/Invoice sections' own discipline — that was inaccurate. `evaluateAssetPermission`/`resolveAssetVisibility` are real, tested engines, but no Client Portal route or Server Action calls them; there is no `/client-access/assets` (or equivalent) surface today. The client-viewer logic above is implemented and exercised only by this platform's own tests — it has no live Client Portal caller yet. Tracked in `docs/v1.0-known-limitations.md`.

## Executive Decisions (Step 14)

`digitalAssetsRecommendationsForExecutiveDecisions()` is one more zero-arg `recommendationSources` entry in `executiveDecisionsActions.ts` — translating the real Health Engine's findings (Unused Assets, Missing Metadata, Permission Problems, Assets Without Preview per-asset; Large Storage Growth and Folders Needing Organization workspace-wide) into `OperationalRecommendation`s, never a second decision engine.

## Module actions (Step 15)

`modules/digitalAssets/digitalAssetsActions.ts` composes the real repository for every mutation — folders, versions, search, favorites, comments (thin pointer into the real Comments Platform with `owner_type: "media_asset"`), reviews, shares, downloads, views — plus two read-model builders: `evaluateAssetAction` (the Asset Detail page's own bundle: metadata, preview, usage, permission, health, versions, reviews, shares, favorite state) and `evaluatePlatformAction` (the Dashboard's own bundle: platform health + analytics). Authentication follows the same `session.kind !== "active"` gate every other module actions layer uses; the finer `assets.view`/`assets.manage` split stays enforced client-side, exactly as `AssetLibraryView.tsx` already did before this checkpoint.

## Known limitations (disclosed, not hidden)

1. **No real thumbnail generation** — `AssetPreview.thumbnailAvailable` is always `false`. The Preview Engine only classifies preview *behavior* (Step 6's own "never render actual files" instruction), never generates or fetches a thumbnail image.
2. **Version restore is an inert placeholder** — restoring a prior version would need that version's original bytes, which the live blob store never kept once superseded. `restoreAssetVersionPlaceholderAction` always returns `supported: false` and logs the attempt (`asset_version_restore_attempted`) rather than silently succeeding.
3. **"Duplicate Placeholder" detection is real, resolution is not** — the Health Engine's checksum comparison genuinely finds byte-identical files; there is no merge/dedupe workflow to act on the finding yet.
4. **No real external sharing** — `AssetShare` records an internal audit trail only; no email, link, or access token is ever generated.
5. **Client-visible previews still route through the same download URL mechanism Checkpoint 25 built** — no dedicated client-safe preview endpoint exists this checkpoint; `AssetPermission`'s `preview` check is a capability answer, not a new rendering surface.

No Google Drive, Dropbox, AWS S3, Cloudflare R2, OneDrive, real upload API, image processing, OCR, AI, automatic tagging, image/face recognition, background jobs, or CDN was implemented — all remain explicitly out of scope, reserved for a future External Integrations phase.
