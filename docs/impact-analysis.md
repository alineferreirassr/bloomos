# Impact Analysis

See `docs/dependency-engine.md` for the full architecture — Impact Analysis and the Dependency Engine are the same system (`core/knowledge/impactAnalysisEngine.ts`), covered together there per the spec's own "Dependency & Impact Engine" (Step 10.8) naming. This document is the shorter, UI-facing companion: where Impact Analysis actually surfaces to a user before they do something destructive.

## Where it appears

1. **Asset Intelligence page** (`modules/assets/components/AssetDetailView.tsx`) — a "Dependencies & Impact Analysis" card shows the non-zero affected categories (Events, Clients, Documents, Workflows, Automations, Collections, Timeline Entries, AI Context) plus a plain-language "safe to delete" line when nothing depends on the asset.
2. **Relationship Explorer** (`docs/graph-explorer.md`) — the Node Inspector's "Dependencies & Impact Analysis" panel runs the same computation for any node type, not just Media Assets, via `getNodeRelationshipsAction()`.
3. **Knowledge Health** (`docs/knowledge-health.md`) — doesn't call Impact Analysis directly, but shares its underlying traversal engine.

## What "impact" means here

Impact Analysis only counts **inbound** relationships — things that point *at* the node in question. An asset's own outbound edges (e.g. `belongs_to` its owner Event) never count as something that would be "affected" by deleting the asset, since deleting the asset doesn't touch the Event. This is enforced in `computeImpactAnalysis` by filtering to `getInboundRelationships(node, relationships)` only.

## Known limitation

There is no UI gate yet that *blocks* a destructive action when impact is non-empty — the Asset Detail page's Approve/Reject actions don't touch deletion, and no delete-asset flow exists yet in this checkpoint (only archive/restore, which are non-destructive and reversible). Impact Analysis is fully computed and displayed; wiring it as a hard confirmation gate in front of an eventual hard-delete action is future work, not something this checkpoint claims to have built.

## Tests

See `docs/dependency-engine.md`'s Tests section — the same suite (`impactAnalysisEngine.test.ts`) covers both.
