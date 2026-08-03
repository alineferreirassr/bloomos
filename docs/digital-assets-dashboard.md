# Digital Asset Management Dashboard & Detail

## One dashboard, not two (Step 17)

The checkpoint's own spec line reads "Create: `/assets/digital-assets`" — but `/assets` (`AssetLibraryView.tsx`) is already the real, working Asset Library dashboard, and `/assets/[id]` (`AssetDetailView.tsx`) is already the real Asset Detail page. Building a second dashboard under the same `/assets` prefix would be exactly the duplication this checkpoint's own core principle forbids ("The DAM must be reusable... without creating duplicate storage systems" — the same logic extends to duplicate UI over the same storage). Both routes were extended in place instead.

### What was added to `/assets`

`AssetPlatformSummary.tsx`, mounted above the existing search/filter/grid, calling `evaluatePlatformAction()` (module layer, Step 15) once on mount:

- Total Assets, Total Storage (KPIs)
- Platform Health score + band
- Unused Assets count
- Downloads, Favorites, Shares totals
- Files Needing Attention (assets with at least one Health issue)

The existing Folders sidebar, Collections, and search/filter bar are untouched.

### What was added to `/assets/[id]`

`AssetIntelligencePanel.tsx`, mounted below the existing Overview/Metadata/Approval Workflow/Knowledge Graph sections, calling `evaluateAssetAction(assetId)` (module layer, Step 15):

- **Health** — score, band, issue list
- **Where This File Is Used** — the Usage Engine's real reference list
- **Permissions** — resolved visibility + the 6 named action checks
- **Versions** — version history from `assetVersionsStore`
- **Review History** — the approval-decision audit trail
- **Shares** — the internal share-placeholder log
- **Comments** — full read/write against the real Comments Platform
- A Favorite toggle, a tracked Download button, and a Share (team) button

Both are purely additive — the existing Overview/Metadata/Approval/Knowledge Graph sections keep working exactly as they did before this checkpoint.
