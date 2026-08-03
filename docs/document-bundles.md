# Document Bundles

**Status: v2 Checkpoint 44, Steps 5 & 14.** A named group of already-existing client-facing documents — a Proposal, a Contract, an Invoice, a Composed Document — sent, tracked, and viewed together, without copying, re-storing, or duplicating any of their content.

## Why this exists

The audit for this checkpoint found no way to hand a Client a single "Welcome Packet" that bundles their Proposal, Contract, and Invoice as one unit — each lived only on its own dashboard, with no shared status or send flow. Document Bundles closes that gap the same way every prior extension in this checkpoint does: by referencing existing records, never copying them.

## Domain (`types/documentPlatform.ts`)

```ts
type DocumentBundleItemKind = "composed_document" | "proposal" | "contract" | "invoice";

interface DocumentBundleItem {
  id: string;
  kind: DocumentBundleItemKind;
  refId: string;      // the id of the real record this item points at — never a copy of its data
  addedAt: string;
}

type DocumentBundleStatus = "draft" | "ready" | "sent" | "viewed";  // forward-only

interface DocumentBundle {
  id: string; workspaceId: string; clientId: string | null; eventId: string | null;
  title: string; description: string; status: DocumentBundleStatus;
  items: DocumentBundleItem[];
  createdBy: string; createdAt: string; updatedAt: string; sentAt: string | null;
}
```

A `DocumentBundleItem` is a pointer, not a copy — the same "reference, never embed" relationship a Workflow node has to its own Automation Action definition. `ResolvedDocumentBundleItem` (`{item, title, subtitle, available}`) is the read-time projection `resolveBundleItems()` (`core/documents/bundleResolver.ts`) assembles by looking up each item's real record fresh on every read; `available: false` means the referenced record (e.g. an archived Proposal) no longer exists — a Bundle can never silently show stale data because nothing is ever cached into it.

## Storage & Manager (`core/documents/manager.ts`, `lib/data/core/documents/`)

`getDocumentsManager()` — the same Runtime entry point the rest of the Document Platform already uses — gained five methods: `createDocumentBundle`, `getDocumentBundleById`, `listDocumentBundlesForClient`, `addDocumentBundleItem` / `removeDocumentBundleItem`, `updateDocumentBundleStatus`. No new store, no new manager — `DocumentBundle` records live in the same `mockRepository.ts` every `ComposedDocument`/`Template` already persists into, workspace-scoped throughout.

## Health & Analytics (Step 12)

`computeDocumentBundleHealth(bundle, resolvedItems, evaluatedAt)` (`core/documents/documentHealthEngine.ts`) scores four categories — `completeness`, `items_availability`, `client_link`, `send_readiness` — following the exact `{category, score, issues, notApplicableReason}` shape every Health Engine in this codebase already uses (Contract, Invoice, Proposal). `computeDocumentAnalytics(documents, bundles, evaluatedAt)` (`core/documents/documentAnalyticsEngine.ts`) folds Bundle counts by status and average items-per-bundle into the same `DocumentAnalyticsSnapshot` that also covers Composed Documents.

Two new registered metrics (`modules/analytics/metrics/documentMetrics.ts`): `documents.bundlesCreated` and `documents.bundleSendRate`.

## Timeline & Executive Integration (Step 13)

Six new `TimelineActivityType` entries (`core/enums/timelineActivityType.ts`): `document_bundle_created`, `document_bundle_item_added`, `document_bundle_item_removed`, `document_bundle_ready`, `document_bundle_sent`, `document_bundle_viewed` — every real mutation in `manager.ts` calls `recordTimelineActivity()`, which means each one is automatically usable as a generic `trigger.timeline-event` Workflow Trigger (Checkpoint 39) with zero new Workflow code.

`documentPlatformRecommendationsForExecutiveDecisions()` (`core/documents/executiveIntegration.ts`) flags two situations to the Executive Decisions queue: a Bundle referencing an item that's no longer available, and a Bundle with items that's been sitting in `draft` (send-readiness score 0). A workspace-wide "5+ generated documents never published" recommendation folds in alongside it. Registered as its own `recommendationSources` entry (`generatedBy: "document_platform_engine"`) in `executiveDecisionsActions.ts`, the same additive pattern every other platform's recommendations already use — an empty array here never blocks Executive Decisions from evaluating.

`document_bundle` was also added to the closed `ENTITY_TYPES`/`KnowledgeNodeType` sets so a Bundle can be referenced as a Knowledge Graph node and an Executive Decision's own `node` target.

## Module Actions (`modules/documentTemplates/documentBundleActions.ts`)

The session-gated wrapper layer Document Bundles never had until Step 14 — matches `contractPlatformActions.ts`'s exact `session → workspace-ownership guard → manager call` shape:

| Action | Gate |
|---|---|
| `createDocumentBundleAction(input)` | `documents.create` |
| `listDocumentBundlesForClientAction(clientId)` | any active session |
| `getDocumentBundleDetailAction(bundleId)` | workspace ownership only |
| `addDocumentBundleItemAction` / `removeDocumentBundleItemAction` | `documents.update` + ownership |
| `updateDocumentBundleStatusAction(bundleId, status)` | `documents.update` + ownership |

## UI (Step 14)

- **`DocumentBundlesSection`** (`modules/documentTemplates/components/DocumentBundlesSection.tsx`) — a self-fetching rollup added to the real Client Detail page (`modules/clients/components/ClientDetailView.tsx`), alongside `DocumentsSummarySection`/`ClientAccessSection`/`ClientPortalActivitySection`. Lists a client's Bundles with a status `Badge` and item count; "New Bundle" creates one in `draft` and reloads.
- **`DocumentBundleDetailView`** (`modules/documentTemplates/components/DocumentBundleDetailView.tsx`) at `/documents/bundles/[id]` — the forward-only status machine (`draft → ready → sent → viewed`) surfaced as a single "Mark {next status}" action, the Bundle Health card (`ProgressBar` + per-category scores + issues), and the Items list with per-item availability and a Remove action.

## Testing

`documentHealthEngine.test.ts`, `documentAnalyticsEngine.test.ts`, `executiveIntegration.test.ts`, `getDocumentHealthAction.test.ts`, `getDocumentAnalyticsAction.test.ts`, `documentBundleActions.test.ts`, and a Timeline-wiring test in `manager.test.ts` cover the full lifecycle: create → add item → remove item → status advance → health scoring → analytics rollup → recommendation generation, plus every permission/ownership/not-found branch in the module actions layer.
