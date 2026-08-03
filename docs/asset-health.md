# Asset Health

`core/digitalAssets/healthEngine.ts` — every issue type is a deterministic check over real fields, never inferred or AI-scored.

## The 8 named issues

| Issue | Trigger | Weight |
|---|---|---|
| `unused_asset` | `usage.isUnused` (see [`digital-assets.md`](digital-assets.md)'s Usage Engine section) | 15 |
| `missing_metadata` | `!metadata.isComplete` (see [`metadata.md`](metadata.md)) | 10 |
| `no_folder` | `folder_id === null` | 5 |
| `no_tags` | `tags.length === 0` | 5 |
| `old_version` | Not updated in over a year — a deliberately generous threshold so a stable, still-relevant brand asset isn't flagged every quarter | 10 |
| `no_preview` | `previewType === "unknown"` | 10 |
| `permission_problem` | A client-owned asset whose resolved visibility isn't client-facing | 20 |
| `duplicate_placeholder` | Another active asset shares the exact same checksum | 15 |

## Scoring

Every asset starts at 100; each triggered issue subtracts its weight, floored at 0. Bands: 90+ excellent, 70+ good, 40+ attention, below critical.

## "Duplicate Placeholder" — real detection, no resolution workflow

The name keeps the spec's own wording, but the check itself is real: two assets' checksums are compared directly, and a match means the file bytes are genuinely identical. What doesn't exist is a merge/dedupe *workflow* to act on the finding — a team member sees the flag and has to resolve it manually today.

## Named functions

| Function | Purpose |
|---|---|
| `evaluateAssetHealth(asset, context)` | Per-asset `AssetHealth` — score, band, issue list |
| `bandForScore(score)` | Score → band |
| `summarizePlatformHealth(workspaceId, healthResults)` | Workspace-wide `PlatformHealthSummary` — average score, issue breakdown, assets-with-issues count |
